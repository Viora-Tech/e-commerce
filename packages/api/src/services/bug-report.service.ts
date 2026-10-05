import { randomUUID } from 'node:crypto'
import { CommerceError, type RateLimitRule } from '@commerce/core'
import { formatInZone } from '@commerce/dates'
import { type Db, type StoreTx, withStore } from '@commerce/db'
import type { StorageProvider } from '@commerce/storage'
import { storeRegistries } from './apps.service'
import { storageProviderFor } from './media.service'
import { storeNameOf } from './staff-invites.service'

/**
 * "Report a bug" (test server only, `BUG_REPORTS_ENABLED`): turns what a member typed, plus
 * what the page and the server know, into one GitHub issue. Pure helpers (scrubbing, the issue
 * text, the screenshot check) plus the two outside calls (storage, GitHub), each injected so
 * tests never reach either. Developer docs: Operations > Bug reports.
 */

/** Ten reports an hour per person: plenty for someone clicking through, useless to a script. */
export const BUG_REPORT_RULE: RateLimitRule = { limit: 10, windowMs: 60 * 60_000 }

/** Labels that already exist on the repository; GitHub refuses unknown labels for most tokens. */
const BUG_REPORT_LABELS = ['bug', 'test-server'] as const

export const BUG_SUMMARY_MAX = 200
export const BUG_DETAILS_MAX = 4000
export const BUG_ERRORS_MAX = 20
export const BUG_ERROR_LENGTH_MAX = 500
const SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024
/** The longest data URL a 2 MB image makes (base64 is 4 characters per 3 bytes). */
export const SCREENSHOT_DATA_URL_MAX =
  'data:image/jpeg;base64,'.length + Math.ceil(SCREENSHOT_MAX_BYTES / 3) * 4

const REDACTED = '[redacted]'

/** `Bearer <token>` anywhere (headers pasted into a report, fetch errors). */
const BEARER = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi

/** `key=value` / `"apiKey": "value"` where the name says secret. Keeps the name, drops the value. */
const SECRET_PAIR =
  /(["']?\b[\w-]*(?:token|secret|passw(?:or)?d|pwd|key|otp|signature|session|cookie|credential|auth)[\w-]*["']?\s*[:=]\s*["']?)([^\s"'&,;)}\]<>[]+)/gi

/** A six-digit code with "code", "OTP" or "PIN" just before it... */
const CODE_AFTER_WORD = /\b(code|otp|pin)\b([^\d\n]{0,20}?)\b\d{6}\b/gi
/** ...or just after it ("123456 is your login code"). */
const CODE_BEFORE_WORD = /\b\d{6}\b(?=[^\d\n]{0,20}\b(?:code|otp|pin)\b)/gi

/** Longer than 32 characters of hex: hashes, signatures, raw keys. */
const LONG_HEX = /\b[0-9a-fA-F]{33,}\b/g
/** Longer than 32 base64-ish characters. Only redacted when it mixes upper, lower and digits. */
const LONG_BASE64 = /[A-Za-z0-9+/_-]{33,}={0,2}/g

function looksRandom(s: string): boolean {
  return /[0-9]/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s)
}

/**
 * Removes what looks like a credential from free text: `key=value` pairs whose name says
 * token/secret/password/key, `Bearer` tokens, six-digit codes next to "code"/"OTP", and long
 * hex or mixed-case base64 runs. Slugs, ids, order numbers and prose survive.
 */
export function scrubSecrets(text: string): string {
  return text
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(SECRET_PAIR, (_all, name: string) => `${name}${REDACTED}`)
    .replace(CODE_AFTER_WORD, (_all, word: string, gap: string) => `${word}${gap}${REDACTED}`)
    .replace(CODE_BEFORE_WORD, REDACTED)
    .replace(LONG_HEX, REDACTED)
    .replace(LONG_BASE64, (run) => (looksRandom(run) ? REDACTED : run))
}

/** What the browser sends (already length-checked by the router). */
export type BugReportInput = {
  summary: string
  details?: string | undefined
  path: string
  viewport: string
  userAgent: string
  recentErrors: string[]
}

/** What the server adds. */
export type BugReportContext = {
  storeName: string
  storeId: string
  reporter: { name: string; email: string; role: string }
  commit: string
  at: Date
  screenshotUrl: string | null
}

export type BugIssue = { title: string; body: string }

/** `@name` in typed text would ping a GitHub user; a zero-width space after `@` stops it. */
function noMentions(text: string): string {
  return text.replace(/(^|[^\w])@(?=\w)/g, `$1@${String.fromCharCode(0x200b)}`)
}

/** One markdown table cell: no pipes, no line breaks. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')
}

/** Inline code that cannot be broken out of. */
function code(text: string): string {
  return `\`${cell(text.replace(/`/g, "'"))}\``
}

/** A fence longer than any backtick run inside, so pasted code cannot close it early. */
function fenced(lines: string[]): string {
  const longest = Math.max(
    2,
    ...lines.map((l) => Math.max(0, ...(l.match(/`+/g) ?? []).map((r) => r.length))),
  )
  const fence = '`'.repeat(longest + 1)
  return `${fence}text\n${lines.join('\n')}\n${fence}`
}

/** The issue title and markdown body. Everything the member or the page supplied is scrubbed. */
export function buildBugIssue(input: BugReportInput, ctx: BugReportContext): BugIssue {
  const summary = scrubSecrets(input.summary.trim())
  const details = scrubSecrets(input.details?.trim() ?? '')
  const errors = input.recentErrors.map((e) => scrubSecrets(e).replace(/\s*\n\s*/g, ' '))
  const time = formatInZone(ctx.at, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const { reporter } = ctx

  const body = [
    '### What went wrong',
    noMentions(summary),
    '',
    '### What they were doing just before',
    details ? noMentions(details) : '_Not given._',
    '',
    '### Screenshot',
    ctx.screenshotUrl ? `![Screenshot of the page](${ctx.screenshotUrl})` : '_No screenshot._',
    '',
    '### Where and who',
    '| | |',
    '| --- | --- |',
    `| Page | ${code(scrubSecrets(input.path))} |`,
    `| Store | ${cell(ctx.storeName)} (${code(ctx.storeId)}) |`,
    `| Reported by | ${cell(reporter.name)} (${cell(reporter.email)}), ${cell(reporter.role)} |`,
    `| Screen | ${cell(scrubSecrets(input.viewport))} |`,
    `| Browser | ${cell(scrubSecrets(input.userAgent))} |`,
    `| Commit | ${code(ctx.commit)} |`,
    `| Time | ${cell(time)} IST |`,
    '',
    `### Recent errors in the browser (${errors.length})`,
    errors.length ? fenced(errors) : '_None since the page loaded._',
    '',
    '<sub>Sent with the admin\'s "Report a bug" button. Tokens, codes and secrets were removed from the text before sending.</sub>',
  ].join('\n')

  return { title: summary, body }
}

export type Screenshot = {
  bytes: Uint8Array
  contentType: 'image/png' | 'image/jpeg'
  ext: 'png' | 'jpg'
}

/** Why a screenshot was refused; the router turns it into a plain BAD_REQUEST. */
export class InvalidScreenshot extends CommerceError {
  constructor(message: string) {
    super('BUG_REPORT_SCREENSHOT', message)
  }
}

const DATA_URL = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_MAGIC = [0xff, 0xd8, 0xff]

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((b, i) => bytes[i] === b)
}

/** A PNG or JPEG data URL, at most 2 MB, whose bytes really are the type it claims. */
export function decodeScreenshot(dataUrl: string): Screenshot {
  const m = dataUrl.match(DATA_URL)
  if (!m) throw new InvalidScreenshot('The screenshot must be a PNG or JPEG image.')
  const contentType = m[1] as Screenshot['contentType']
  const bytes = new Uint8Array(Buffer.from(m[2] as string, 'base64'))
  if (bytes.byteLength > SCREENSHOT_MAX_BYTES) {
    throw new InvalidScreenshot('The screenshot is over 2 MB.')
  }
  const real =
    contentType === 'image/png' ? startsWith(bytes, PNG_MAGIC) : startsWith(bytes, JPEG_MAGIC)
  if (!real) throw new InvalidScreenshot('The screenshot must be a PNG or JPEG image.')
  return { bytes, contentType, ext: contentType === 'image/png' ? 'png' : 'jpg' }
}

/** The commit this build runs: SOURCE_COMMIT, then SENTRY_RELEASE, else "unknown". */
export function appCommit(env: {
  SOURCE_COMMIT?: string | undefined
  SENTRY_RELEASE?: string | undefined
}): string {
  return env.SOURCE_COMMIT ?? env.SENTRY_RELEASE ?? 'unknown'
}

/**
 * The store's name, and, with a screenshot, the store's own storage provider (the same one
 * media uploads use). One short transaction; the upload itself happens after it closes.
 */
export async function bugReportStore(
  db: Db,
  storeId: string,
  secret: string,
  withStorage: boolean,
) {
  return withStore(db, storeId, async (tx: StoreTx) => {
    const name = (await storeNameOf(tx, storeId)) ?? 'Unknown store'
    if (!withStorage) return { name, storage: null }
    const { storage } = await storeRegistries(tx, storeId)
    return { name, storage: await storageProviderFor(tx, storeId, storage, secret) }
  })
}

/** Saves the screenshot under the store's folder with an unguessable name; resolves its URL. */
export async function uploadScreenshot(
  storage: Pick<StorageProvider, 'put' | 'publicUrl'>,
  storeId: string,
  shot: Screenshot,
): Promise<string> {
  const key = `stores/${storeId}/bug-reports/${randomUUID()}.${shot.ext}`
  await storage.put({ key, body: shot.bytes, contentType: shot.contentType })
  return storage.publicUrl(key)
}

/** GitHub refused or could not be reached. Carries the HTTP status only, never the token. */
export class GithubIssueError extends CommerceError {
  constructor(readonly status: number | null) {
    super('BUG_REPORT_GITHUB', status ? `GitHub answered ${status}` : 'GitHub could not be reached')
  }
}

/** `POST /repos/{repo}/issues`. `fetch` is injected: tests pass a fake, the app the real one. */
export async function fileGithubIssue(input: {
  fetch: typeof fetch
  token: string
  repo: string
  issue: BugIssue
}): Promise<{ number: number; url: string }> {
  let res: Response
  try {
    res = await input.fetch(`https://api.github.com/repos/${input.repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'vextro-bug-reports',
      },
      body: JSON.stringify({ ...input.issue, labels: [...BUG_REPORT_LABELS] }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new GithubIssueError(null)
  }
  if (!res.ok) throw new GithubIssueError(res.status)
  const json = (await res.json()) as { number?: unknown; html_url?: unknown }
  if (typeof json.number !== 'number' || typeof json.html_url !== 'string') {
    throw new GithubIssueError(res.status)
  }
  return { number: json.number, url: json.html_url }
}
