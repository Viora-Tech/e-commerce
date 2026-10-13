import type { BrowserSentryConfig } from './browser-sentry-config'
import { scrubPii } from './scrub-pii'

/** The subset of the browser SDK's options every app sets; structural, so no SDK dependency here. */
export type BrowserSentryOptions = {
  dsn: string
  environment: string
  release: string | undefined
  tracesSampleRate: 0
  sendDefaultPii: false
  sendClientReports: false
  beforeSend: <T>(event: T) => T | null
}

/** The parts of a Sentry error event the filters read. */
type Frame = { filename?: string; abs_path?: string; lineno?: number; colno?: number }
type ErrorEventLike = {
  message?: string
  fingerprint?: string[]
  exception?: {
    values?: { type?: string; value?: string; stacktrace?: { frames?: Frame[] } }[]
  }
}

/** Errors that are never a bug of ours, matched against `Type: message` and the message alone. */
const NOISE = [
  // Chrome / Firefox / Safari wording of the same harmless layout warning.
  /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i,
  // A cross-origin script threw; the browser hides everything but this.
  /^Script error\.?$/,
  // A fetch cut short: the shopper navigated away, closed the tab or lost signal.
  /^AbortError\b/,
  /\b(the )?(user|operation) (aborted|was aborted)/i,
  /^TypeError: Load failed$/,
  /^TypeError: Failed to fetch$/,
  /^TypeError: NetworkError when attempting to fetch resource\.?$/,
  /^TypeError: (cancelled|The network connection was lost\.?)$/,
]

/** Code a browser extension injected into the page. */
const EXTENSION_URL = /^(chrome|moz|safari|safari-web|ms-browser)-extension:\/\//

/** At most this many events from one page load, whatever they are. */
const MAX_EVENTS_PER_PAGE = 30

function frames(event: ErrorEventLike): Frame[] {
  return event.exception?.values?.flatMap((v) => v.stacktrace?.frames ?? []) ?? []
}

/** The frame that threw: Sentry lists frames oldest call first. */
function topFrame(event: ErrorEventLike): Frame | undefined {
  const last = event.exception?.values?.at(-1)?.stacktrace?.frames
  return last?.at(-1)
}

const frameUrl = (frame: Frame | undefined) => frame?.abs_path || frame?.filename || ''

/**
 * True for an event that is not ours to fix: known browser noise, anything a browser extension
 * ran, and errors thrown by a script on another origin (third-party tags, payment widgets). An
 * event with no stack (a plain message) is kept.
 */
export function isBrowserNoise(event: ErrorEventLike, origin: string): boolean {
  const texts = (event.exception?.values ?? []).flatMap((v) => [
    v.value ?? '',
    `${v.type ?? 'Error'}: ${v.value ?? ''}`,
  ])
  if (event.message) texts.push(event.message)
  if (texts.some((text) => NOISE.some((re) => re.test(text)))) return true
  if (frames(event).some((f) => EXTENSION_URL.test(frameUrl(f)))) return true
  const thrownAt = frameUrl(topFrame(event))
  return /^https?:\/\//.test(thrownAt) && !thrownAt.startsWith(`${origin}/`)
}

/** One key per distinct bug: its fingerprint, or type, message and the line that threw. */
function fingerprintOf(event: ErrorEventLike): string {
  if (event.fingerprint?.length) return event.fingerprint.join('|')
  const value = event.exception?.values?.at(-1)
  const at = topFrame(event)
  return [value?.type, value?.value ?? event.message, frameUrl(at), at?.lineno, at?.colno].join('|')
}

/**
 * A gate that lets each fingerprint through once, and at most `MAX_EVENTS_PER_PAGE` in all,
 * so one bug in a loop or a render that keeps failing can't flood GlitchTip. Its memory lasts
 * as long as the page (a full reload starts over).
 */
export function oncePerFingerprint(): (event: ErrorEventLike) => boolean {
  const seen = new Set<string>()
  return (event) => {
    const key = fingerprintOf(event)
    if (seen.has(key) || seen.size >= MAX_EVENTS_PER_PAGE) return false
    seen.add(key)
    return true
  }
}

/** Keys whose whole value is a URL (absolute or relative): query and hash are dropped. */
const URL_KEYS = new Set(['url', 'from', 'to', 'abs_path', 'filename', 'referer', 'referrer'])
/** An absolute URL inside free text (a message, a breadcrumb), up to its query or hash. */
const URL_IN_TEXT = /(\bhttps?:\/\/[^\s?#'"<>]+)[?#][^\s'"<>]*/g

function stripValue(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    if (key && URL_KEYS.has(key.toLowerCase())) return value.replace(/[?#][\s\S]*$/, '')
    return value.replace(URL_IN_TEXT, '$1')
  }
  if (Array.isArray(value)) return value.map((v) => stripValue(v))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'query_string') continue
      out[k] = stripValue(v, k)
    }
    return out
  }
  return value
}

/**
 * Drops every URL query string and hash from an event (the page URL, the referrer, breadcrumb
 * and stack-frame URLs, URLs inside messages): they can carry an order token, an email or a
 * password-reset code. Returns a new object; never mutates the input.
 */
export function stripQueryStrings<T>(event: T): T {
  return stripValue(event) as T
}

/**
 * SOURCE OF TRUTH KEYWORDS: browserSentryOptions, beforeSend, isBrowserNoise,
 *        oncePerFingerprint, stripQueryStrings, scrubPii
 * WHAT:  The browser Sentry (GlitchTip) options for the admin and storefront: errors only (no
 *        tracing, replay, sessions or client reports, no default PII), noise filtered, each
 *        bug sent once per page load, query strings dropped and PII scrubbed before sending.
 * WHY:   Both apps must filter and scrub the same way; the storefront runs on shoppers'
 *        phones, where extensions, flaky networks and third-party tags make most of the noise.
 *        Structural type so this package stays SDK-free.
 * WHERE: apps/admin and apps/storefront `src/lib/browser-errors.ts`, started from
 *        `instrumentation-client.ts`; see docs/ops/error-tracking.md, "Browser errors".
 */
export function browserSentryOptions(
  config: BrowserSentryConfig,
  /** The page's own origin (`location.origin`): errors thrown by scripts elsewhere are dropped. */
  origin: string,
): BrowserSentryOptions {
  const firstTime = oncePerFingerprint()
  return {
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    sendClientReports: false,
    beforeSend: (event) => {
      const e = event as ErrorEventLike
      if (isBrowserNoise(e, origin) || !firstTime(e)) return null
      return scrubPii(stripQueryStrings(event))
    },
  }
}
