/** SOURCE OF TRUTH: "Send HTTP request" automation action — WHAT: one signed HTTPS request per step to a public host (SSRF guard via `safeFetch`: every resolved address and redirect checked, 30 s timeout, 1 MB read cap), with `{{secrets.handle}}` values from `automation_secret` filled in but never logged, an `Idempotency-Key` of the step key, per-store rate and concurrency caps, and Flow's Retry / Fail / Continue choice on error answers / WHY: data leaves the platform here (a sensitive action, Growth plan and up), so it must never reach our own network, leak a secret into the run log, or hammer a merchant's endpoint. Server-only. Design §8.4, §8.5. */
import { createHmac } from 'node:crypto'
import { siteConfig } from '@commerce/config/site'
import { automationSecret, type StoreTx } from '@commerce/db'
import { and, eq, inArray } from 'drizzle-orm'
import { BlockedUrlError, readCapped, safeFetch } from '../../net/safe-fetch'
import { checkRateLimit, rateLimitKey } from '../../rate-limit/limiter'
import { decryptSecret } from '../../secrets'
import { type ActionContext, type ActionExecutor, AutomationActionError } from '../executor'
import type { BuiltinActionDeps, DepsFor } from './shared'

type HttpConfig = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  headers: { name: string; value: string }[]
  body: string
  onHttpError: 'retry' | 'fail' | 'continue'
}

/** `{{secrets.api_key}}` in the URL, a header or the body. */
const SECRET_TAG = /\{\{\s*secrets\.([a-z0-9_-]+)\s*\}\}/gi
/** A store secret with this handle signs requests instead of the derived key. */
export const HTTP_SIGNING_SECRET_HANDLE = 'signing_key'
const TIMEOUT_MS = 30_000
const MAX_RESPONSE_BYTES = 1024 * 1024
/** Response text kept in the step output (the run log), after secrets are masked. */
const KEPT_BODY_CHARS = 4000
const PER_STORE_RATE = { limit: 10, windowMs: 1000 }
const PER_STORE_CONCURRENCY = 5
const MASK = '•••'
/** Headers the step may not set: the transport's own, and our signature. */
const RESERVED_HEADERS = new Set([
  'host',
  'content-length',
  'connection',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
  'keep-alive',
  'proxy-authorization',
  'idempotency-key',
  'x-webhook-signature',
  'x-webhook-timestamp',
  'x-automation-workflow',
])
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/

/**
 * The key a store's requests are signed with when it has no `signing_key` secret: derived
 * from the platform secret, so it is stable and the API can show it to the merchant.
 */
export function httpSigningKey(storeId: string, settingsSecret: string): string {
  return createHmac('sha256', settingsSecret).update(`automations-http:${storeId}`).digest('hex')
}

/** `t=<unix seconds>` and `sha256=<hex HMAC of "<t>.<body>">`, like Stripe's scheme. */
export function signRequest(key: string, timestamp: number, body: string): string {
  return `sha256=${createHmac('sha256', key).update(`${timestamp}.${body}`).digest('hex')}`
}

const handlesIn = (texts: string[]): string[] => [
  ...new Set(
    texts.flatMap((t) => [...t.matchAll(SECRET_TAG)].map((m) => (m[1] as string).toLowerCase())),
  ),
]

/** The store's secrets the step names, decrypted; unknown handles are reported, never guessed. */
async function loadSecrets(
  tx: StoreTx,
  storeId: string,
  handles: string[],
  settingsSecret: string,
): Promise<Map<string, string>> {
  if (handles.length === 0) return new Map()
  const rows = await tx
    .select({ handle: automationSecret.handle, value: automationSecret.valueEncrypted })
    .from(automationSecret)
    .where(and(eq(automationSecret.storeId, storeId), inArray(automationSecret.handle, handles)))
  return new Map(rows.map((r) => [r.handle.toLowerCase(), decryptSecret(r.value, settingsSecret)]))
}

const fillSecrets = (text: string, values: ReadonlyMap<string, string>) =>
  text.replace(SECRET_TAG, (_w, h: string) => values.get(h.toLowerCase()) ?? '')

const maskSecrets = (text: string) => text.replace(SECRET_TAG, MASK)

/** Every secret value replaced by •••, for anything stored or shown. */
function redact(text: string, values: Iterable<string>): string {
  let out = text
  for (const v of values) if (v.length >= 4) out = out.split(v).join(MASK)
  return out
}

type Prepared = {
  method: HttpConfig['method']
  url: string
  /** Shown and stored: the URL with secrets masked. */
  shownUrl: string
  headers: Record<string, string>
  body: string
  secrets: Map<string, string>
  missing: string[]
}

async function prepare(
  tx: StoreTx,
  ctx: ActionContext,
  config: HttpConfig,
  deps: BuiltinActionDeps,
): Promise<Prepared> {
  const method = config.method ?? 'POST'
  const rawUrl = ctx.render(config.url).trim()
  const rawHeaders = (config.headers ?? []).map((h) => ({
    name: h.name.trim(),
    value: ctx.render(h.value),
  }))
  const rawBody = method === 'GET' ? '' : ctx.render(config.body ?? '')
  const handles = handlesIn([rawUrl, rawBody, ...rawHeaders.map((h) => h.value)])
  const secrets = await loadSecrets(tx, ctx.storeId, handles, deps.settingsSecret)
  const headers: Record<string, string> = {}
  for (const h of rawHeaders) {
    if (!HEADER_NAME.test(h.name) || RESERVED_HEADERS.has(h.name.toLowerCase())) {
      throw new AutomationActionError(`The header "${h.name}" cannot be set`, { retryable: false })
    }
    headers[h.name] = fillSecrets(h.value, secrets).replace(/[\r\n]/g, ' ')
  }
  const body = fillSecrets(rawBody, secrets)
  const hasType = Object.keys(headers).some((n) => n.toLowerCase() === 'content-type')
  if (body && !hasType) {
    headers['Content-Type'] = /^\s*[[{]/.test(body) ? 'application/json' : 'text/plain'
  }
  return {
    method,
    url: fillSecrets(rawUrl, secrets),
    shownUrl: maskSecrets(rawUrl),
    headers,
    body,
    secrets,
    missing: handles.filter((h) => !secrets.has(h)),
  }
}

function checkUrl(url: string): URL {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    throw new AutomationActionError('The address is not a full https:// link', { retryable: false })
  }
  if (u.protocol !== 'https:') {
    throw new AutomationActionError('Only https:// addresses can be called', { retryable: false })
  }
  return u
}

const running = new Map<string, number>()

/** Seconds from a `Retry-After` header (seconds or a date), in ms. */
function retryAfterMs(res: Response): number | undefined {
  const raw = res.headers.get('retry-after')
  if (!raw) return undefined
  const s = Number(raw)
  if (Number.isFinite(s)) return Math.max(0, s * 1000)
  const at = Date.parse(raw)
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now())
}

async function responseText(res: Response): Promise<string> {
  const bytes = await readCapped(res, MAX_RESPONSE_BYTES).catch(() => null)
  if (!bytes) return ''
  return new TextDecoder().decode(bytes).slice(0, KEPT_BODY_CHARS)
}

function networkFailure(err: unknown): AutomationActionError {
  if (err instanceof BlockedUrlError) {
    return new AutomationActionError(`Blocked: ${err.message}`, {
      retryable: false,
      code: 'AUTOMATION_URL_BLOCKED',
      cause: err,
    })
  }
  const name = (err as { name?: string })?.name
  const timeout = name === 'TimeoutError' || name === 'AbortError'
  return new AutomationActionError(
    timeout ? 'The request timed out' : 'The request failed to connect',
    {
      retryable: true,
      cause: err,
    },
  )
}

function httpExecutor(depsFor: DepsFor): ActionExecutor<HttpConfig> {
  return {
    id: 'http.request',
    async run({ tx, ctx, config }) {
      const deps = await depsFor(tx, ctx.storeId)
      const p = await prepare(tx, ctx, config, deps)
      if (p.missing.length) {
        throw new AutomationActionError(`Unknown secret: ${p.missing.join(', ')}`, {
          retryable: false,
        })
      }
      checkUrl(p.url)
      if (deps.rateLimit) {
        const limit = await checkRateLimit(
          deps.rateLimit,
          rateLimitKey('automations-http', ctx.storeId),
          PER_STORE_RATE,
        )
        if (!limit.ok) {
          throw new AutomationActionError('Too many requests from this store right now', {
            retryable: true,
            retryAfterMs: limit.retryAfterMs,
          })
        }
      }
      const busy = running.get(ctx.storeId) ?? 0
      if (busy >= PER_STORE_CONCURRENCY) {
        throw new AutomationActionError('Too many requests at once from this store', {
          retryable: true,
          retryAfterMs: 1000,
        })
      }
      const [signing] = (
        await loadSecrets(tx, ctx.storeId, [HTTP_SIGNING_SECRET_HANDLE], deps.settingsSecret)
      ).values()
      const key = signing ?? httpSigningKey(ctx.storeId, deps.settingsSecret)
      const timestamp = Math.floor(Date.now() / 1000)
      const headers = {
        ...p.headers,
        'User-Agent': `${siteConfig.brand.name}-Automations/1.0`,
        'Idempotency-Key': ctx.stepKey,
        'X-Automation-Workflow': ctx.workflow.id,
        'X-Webhook-Timestamp': String(timestamp),
        'X-Webhook-Signature': signRequest(key, timestamp, p.body),
      }
      running.set(ctx.storeId, busy + 1)
      let res: Response
      try {
        res = await safeFetch(p.url, {
          method: p.method,
          headers,
          body: p.method === 'GET' ? undefined : p.body,
          timeoutMs: TIMEOUT_MS,
          ...(deps.fetch ? { fetch: deps.fetch } : {}),
          ...(deps.lookup ? { lookup: deps.lookup } : {}),
        })
      } catch (err) {
        throw networkFailure(err)
      } finally {
        const n = (running.get(ctx.storeId) ?? 1) - 1
        if (n <= 0) running.delete(ctx.storeId)
        else running.set(ctx.storeId, n)
      }
      const text = redact(await responseText(res), p.secrets.values())
      const output = { method: p.method, url: p.shownUrl, status: res.status, body: text }
      if (res.status < 400) {
        return { summary: `${p.method} ${p.shownUrl}: ${res.status}`, output }
      }
      const transient = res.status === 429 || res.status >= 500
      if (config.onHttpError === 'continue') {
        return { summary: `${p.method} ${p.shownUrl}: ${res.status}, carried on`, output }
      }
      const wait = transient ? retryAfterMs(res) : undefined
      throw new AutomationActionError(`${p.shownUrl} answered ${res.status}`, {
        retryable: config.onHttpError !== 'fail' && transient,
        code: 'AUTOMATION_HTTP_STATUS',
        ...(wait !== undefined ? { retryAfterMs: wait } : {}),
      })
    },
    async preview({ tx, ctx, config }) {
      const deps = await depsFor(tx, ctx.storeId)
      const p = await prepare(tx, ctx, config, deps)
      const warnings: string[] = []
      if (p.missing.length) warnings.push(`Unknown secret: ${p.missing.join(', ')}`)
      let wouldRun = p.missing.length === 0
      try {
        checkUrl(p.url)
      } catch (err) {
        warnings.push((err as Error).message)
        wouldRun = false
      }
      const body = redact(p.body, p.secrets.values()).slice(0, KEPT_BODY_CHARS)
      return {
        summary: `Would ${p.method} to ${p.shownUrl}${body ? ` with body ${body}` : ''}`,
        wouldRun,
        warnings: warnings.length ? warnings : undefined,
        output: { method: p.method, url: p.shownUrl, body },
      }
    },
  }
}

export const httpExecutors = (depsFor: DepsFor): ActionExecutor<never>[] =>
  [httpExecutor(depsFor)] as unknown as ActionExecutor<never>[]
