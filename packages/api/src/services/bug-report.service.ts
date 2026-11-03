import { randomUUID } from 'node:crypto'
import { siteConfig } from '@commerce/config/site'
import { CommerceError, type RateLimitRule, recordBugReport, scrubSecrets } from '@commerce/core'
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
  /**
   * The issues repository is public (`issuesArePublic`): the store, the reporter and the
   * screenshot stay out of the issue (they are kept with the report in the admin), and ids in
   * the page address are hidden.
   */
  public?: boolean
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

/** Ids in a page address (`/orders/<uuid>`, `/products/1234`) become `:id` in a public issue. */
function withoutIds(path: string): string {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d{3,}(?=[/?#]|$)/g, '/:id')
    .replace(/\?.*$/, '')
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
  const page = scrubSecrets(input.path)

  const screenshot = ctx.public
    ? []
    : [
        '### Screenshot',
        ctx.screenshotUrl ? `![Screenshot of the page](${ctx.screenshotUrl})` : '_No screenshot._',
        '',
      ]
  const who = ctx.public
    ? []
    : [
        `| Store | ${cell(ctx.storeName)} (${code(ctx.storeId)}) |`,
        `| Reported by | ${cell(reporter.name)} (${cell(reporter.email)}), ${cell(reporter.role)} |`,
      ]

  const body = [
    '### What went wrong',
    noMentions(summary),
    '',
    '### What they were doing just before',
    details ? noMentions(details) : '_Not given._',
    '',
    ...screenshot,
    ctx.public ? '### Where' : '### Where and who',
    '| | |',
    '| --- | --- |',
    `| Page | ${code(ctx.public ? withoutIds(page) : page)} |`,
    ...who,
    `| Screen | ${cell(scrubSecrets(input.viewport))} |`,
    `| Browser | ${cell(scrubSecrets(input.userAgent))} |`,
    `| Commit | ${code(ctx.commit)} |`,
    `| Time | ${cell(time)} IST |`,
    '',
    `### Recent errors in the browser (${errors.length})`,
    errors.length ? fenced(errors) : '_None since the page loaded._',
    '',
    ctx.public
      ? '<sub>Sent with the admin\'s "Report a bug" button. The store, who reported it and any screenshot stay private with the team. Tokens, codes and secrets were removed from the text before sending.</sub>'
      : '<sub>Sent with the admin\'s "Report a bug" button. Tokens, codes and secrets were removed from the text before sending.</sub>',
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

/**
 * What the member reads when GitHub refuses, by status. "Try again in a minute" only fits
 * outages; a bad or unapproved token fails every time until someone fixes the admin's settings,
 * so say that instead (the token itself is never shown).
 */
export function githubIssueProblem(status: number | null, repo: string): string {
  if (status === 401) {
    return 'The GitHub token on this server is wrong or has expired. Ask the owner to make a new one (admin setting GITHUB_ISSUES_TOKEN).'
  }
  if (status === 403 || status === 404) {
    return `The GitHub token on this server cannot create issues in ${repo}. It needs access to that repository with Issues: Read and write, approved by the organisation.`
  }
  if (status === 410) return `Issues are turned off for ${repo} on GitHub.`
  if (status === 422) {
    return 'GitHub refused the report. The labels "bug" and "test-server" must exist on the repository.'
  }
  if (status === 429) return 'GitHub is limiting requests right now. Try again in a few minutes.'
  if (status === null) return 'GitHub could not be reached. Try again in a minute.'
  return 'GitHub did not take the report. Try again in a minute.'
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
        'User-Agent': `${siteConfig.brand.name.toLowerCase()}-bug-reports`,
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

/**
 * Keeps the report beside its issue (Account → My reports follows it from here). The text is
 * the scrubbed text GitHub got; `issue` is null when no token sent it anywhere.
 */
export async function saveBugReport(
  db: Db,
  storeId: string,
  input: BugReportInput & {
    reporter: { id: string; name: string; email: string }
    screenshotUrl: string | null
    issue: { number: number; url: string } | null
  },
): Promise<string> {
  return withStore(db, storeId, (tx) =>
    recordBugReport(tx, storeId, {
      reporterUserId: input.reporter.id,
      reporterEmail: input.reporter.email,
      reporterName: input.reporter.name,
      title: scrubSecrets(input.summary.trim()),
      description: scrubSecrets(input.details?.trim() ?? ''),
      page: scrubSecrets(input.path),
      screenshotUrl: input.screenshotUrl,
      githubIssueNumber: input.issue?.number ?? null,
      githubIssueUrl: input.issue?.url ?? null,
    }),
  )
}
