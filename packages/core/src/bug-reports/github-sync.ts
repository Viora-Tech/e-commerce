/** SOURCE OF TRUTH: bug report sync with GitHub — WHAT: applies a webhook delivery to the reports filed as that issue (in whichever store), marks fixed reports live once their fix reaches main, and polls open issues as a fallback / WHY: GitHub is where the team works; the reporter reads the result in the admin. Every step is idempotent (same status twice is a no-op), so retried deliveries and the poll never double-notify */
import { bugReportStoresForIssue, type Db, storesWithBugReports, withStore } from '@commerce/db'
import type { GithubRepos } from './client'
import { GithubApiError, type GithubClient, githubClient } from './github'
import {
  type BugReportNotifyOptions,
  type BugReportPatch,
  bugReportsForIssue,
  notifyBugReportUpdate,
  openBugReports,
  patchBugReport,
} from './service'
import {
  type GithubChange,
  latestVisibleReply,
  nextBugReportStatus,
  RELEASE_BRANCH,
  readGithubEvent,
  statusFromIssue,
  verifyGithubSignature,
} from './sync'

export type BugReportSyncDeps = {
  /** Null without GITHUB_ISSUES_TOKEN: webhook changes still apply, nothing is read back. */
  github: GithubClient | null
  /** Null skips telling the reporter (tests, or no ADMIN_URL). */
  notify: BugReportNotifyOptions | null
  now?: () => Date
}

/**
 * The sync's outside world from the apps' settings: a GitHub client when GITHUB_ISSUES_TOKEN
 * is set, telling the reporter with ADMIN_URL (WhatsApp too when the app passes the store's
 * channels). `fetch` is injectable for tests.
 */
export function bugReportSyncDeps(cfg: {
  token: string | undefined
  repo: string
  /** The code's repository, when reports are filed elsewhere (fix commits are checked there). */
  codeRepo?: string | undefined
  adminUrl: string | undefined
  storeChannels?: BugReportNotifyOptions['storeChannels']
  fetch?: typeof fetch
}): BugReportSyncDeps {
  return {
    github: cfg.token
      ? githubClient({
          fetch: cfg.fetch ?? fetch,
          token: cfg.token,
          repo: cfg.repo,
          codeRepo: cfg.codeRepo,
        })
      : null,
    notify: cfg.adminUrl ? { adminUrl: cfg.adminUrl, storeChannels: cfg.storeChannels } : null,
  }
}

export type SyncResult = { updated: number; notified: number }

const NONE: SyncResult = { updated: 0, notified: 0 }

const add = (a: SyncResult, b: SyncResult): SyncResult => ({
  updated: a.updated + b.updated,
  notified: a.notified + b.notified,
})

/** Commit lookups and compare calls one release may make: enough for a release's fixes. */
const RELEASE_COMPARE_MAX = 30

/** One write; when the status became fixed or live, the reporter's email or WhatsApp (as they chose). */
async function writeChange(
  db: Db,
  storeId: string,
  id: string,
  patch: BugReportPatch,
  deps: BugReportSyncDeps,
): Promise<SyncResult> {
  return withStore(db, storeId, async (tx) => {
    const row = await patchBugReport(tx, id, patch, deps.now?.() ?? new Date())
    if (!row) return NONE
    const changed = patch.status !== undefined && (row.status === 'fixed' || row.status === 'live')
    const sent = changed && deps.notify ? await notifyBugReportUpdate(tx, row, deps.notify) : 0
    return { updated: 1, notified: sent }
  })
}

/** The fix commit for an issue that just closed; null when closed by hand or GitHub is off. */
async function closingCommitOf(github: GithubClient | null, issue: number): Promise<string | null> {
  if (!github) return null
  try {
    return await github.closingCommit(issue)
  } catch (err) {
    if (err instanceof GithubApiError) return null
    throw err
  }
}

async function applyIssueStatus(
  db: Db,
  change: Extract<GithubChange, { kind: 'issue_status' }>,
  deps: BugReportSyncDeps,
): Promise<SyncResult> {
  let result = NONE
  let commit: string | null | undefined
  for (const storeId of await bugReportStoresForIssue(db, change.issue)) {
    const rows = await withStore(db, storeId, (tx) => bugReportsForIssue(tx, change.issue))
    for (const row of rows) {
      const next = nextBugReportStatus(row.status, change.status, { reopened: change.reopened })
      if (!next) continue
      const patch: BugReportPatch = { status: next }
      if (next === 'fixed') {
        if (commit === undefined) commit = await closingCommitOf(deps.github, change.issue)
        patch.closedAt = change.closedAt ? new Date(change.closedAt) : new Date()
        patch.fixCommitSha = commit
      }
      if (next === 'in_progress' || next === 'received') {
        patch.closedAt = null
        patch.liveAt = null
        patch.fixCommitSha = null
      }
      result = add(result, await writeChange(db, storeId, row.id, patch, deps))
    }
  }
  return result
}

async function applyReply(
  db: Db,
  change: Extract<GithubChange, { kind: 'reply' }>,
  deps: BugReportSyncDeps,
): Promise<SyncResult> {
  let result = NONE
  for (const storeId of await bugReportStoresForIssue(db, change.issue)) {
    const rows = await withStore(db, storeId, (tx) => bugReportsForIssue(tx, change.issue))
    for (const row of rows) {
      const same = row.staffReplyCommentId === change.commentId
      let patch: BugReportPatch | null = null
      if (change.body === null) {
        // Only the comment the reply came from can clear it.
        if (same) patch = { staffReply: null, staffReplyAt: null, staffReplyCommentId: null }
      } else if (same) {
        if (row.staffReply !== change.body) patch = { staffReply: change.body }
      } else if (!row.staffReplyAt || new Date(change.at) >= row.staffReplyAt) {
        patch = {
          staffReply: change.body,
          staffReplyAt: new Date(change.at),
          staffReplyCommentId: change.commentId,
        }
      }
      if (patch) result = add(result, await writeChange(db, storeId, row.id, patch, deps))
    }
  }
  return result
}

/**
 * A release reached main (`head`): every fixed report whose fix commit is in it goes live. The
 * push's own commit list answers most without a call; otherwise GitHub's compare does (capped).
 * A report closed by hand (no fix commit) counts as shipped by the first release after it closed.
 */
async function markReleasedBugReports(
  db: Db,
  release: { head: string; commits: string[] },
  deps: BugReportSyncDeps,
): Promise<SyncResult> {
  const now = deps.now?.() ?? new Date()
  const pushed = new Set(release.commits)
  let compares = 0
  let result = NONE
  for (const storeId of await storesWithBugReports(db, true)) {
    const rows = await withStore(db, storeId, (tx) =>
      openBugReports(tx, { status: ['fixed'], limit: 200 }),
    )
    for (const row of rows) {
      let live = false
      if (row.fixCommitSha) {
        if (pushed.has(row.fixCommitSha)) live = true
        else if (deps.github && compares < RELEASE_COMPARE_MAX) {
          compares += 1
          try {
            live = await deps.github.contains(release.head, row.fixCommitSha)
          } catch (err) {
            if (!(err instanceof GithubApiError)) throw err
          }
        }
      } else {
        live = row.closedAt !== null && row.closedAt <= now
      }
      if (live) {
        result = add(
          result,
          await writeChange(db, storeId, row.id, { status: 'live', liveAt: now }, deps),
        )
      }
    }
  }
  return result
}

/** Applies one webhook delivery (already signature-checked and read by `readGithubEvent`). */
async function applyGithubChange(
  db: Db,
  change: GithubChange,
  deps: BugReportSyncDeps,
): Promise<SyncResult> {
  switch (change.kind) {
    case 'issue_status':
      return applyIssueStatus(db, change, deps)
    case 'reply':
      return applyReply(db, change, deps)
    case 'release':
      return markReleasedBugReports(db, change, deps)
    default:
      return NONE
  }
}

export type PollResult = SyncResult & { checked: number; failed: number; stopped: boolean }

/**
 * The worker's fallback (every 15 minutes, only with a token): re-reads open reports' issues,
 * least recently synced first, at most `budget` issues a run and none synced in the last
 * `minAgeMs` (the webhook usually got there first). A 401/403 stops the run: every later call
 * would fail the same way.
 */
export async function pollBugReports(
  db: Db,
  deps: BugReportSyncDeps & { github: GithubClient },
  opts: { budget: number; minAgeMs: number },
): Promise<PollResult> {
  const now = deps.now?.() ?? new Date()
  const syncedBefore = new Date(now.getTime() - opts.minAgeMs)
  const out: PollResult = { updated: 0, notified: 0, checked: 0, failed: 0, stopped: false }
  for (const storeId of await storesWithBugReports(db, true)) {
    const left = opts.budget - out.checked
    if (left <= 0) break
    const rows = await withStore(db, storeId, (tx) =>
      openBugReports(tx, { syncedBefore, limit: left }),
    )
    for (const row of rows) {
      const issueNumber = row.githubIssueNumber
      if (issueNumber === null) continue
      out.checked += 1
      try {
        const issue = await deps.github.issue(issueNumber)
        const patch: BugReportPatch = {}
        const status = statusFromIssue(row.status, issue)
        if (status !== row.status) patch.status = status
        const effective = patch.status ?? row.status
        if (effective === 'fixed' && !row.fixCommitSha) {
          patch.fixCommitSha = await deps.github.closingCommit(issueNumber)
          patch.closedAt = issue.closedAt ? new Date(issue.closedAt) : now
        }
        const sha = patch.fixCommitSha ?? row.fixCommitSha
        if (effective === 'fixed' && sha && (await deps.github.contains(RELEASE_BRANCH, sha))) {
          patch.status = 'live'
          patch.liveAt = now
        }
        if (effective === 'in_progress' && row.status !== 'in_progress' && row.closedAt) {
          patch.closedAt = null
          patch.fixCommitSha = null
        }
        const reply = latestVisibleReply(await deps.github.comments(issueNumber))
        if (reply && reply.commentId !== row.staffReplyCommentId) {
          patch.staffReply = reply.body
          patch.staffReplyAt = new Date(reply.at)
          patch.staffReplyCommentId = reply.commentId
        } else if (reply && reply.body !== row.staffReply) {
          patch.staffReply = reply.body
        } else if (!reply && row.staffReplyCommentId) {
          patch.staffReply = null
          patch.staffReplyAt = null
          patch.staffReplyCommentId = null
        }
        const r = await writeChange(db, storeId, row.id, patch, deps)
        // An empty patch still stamps `synced_at`; it is not an update the reporter sees.
        if (Object.keys(patch).length > 0) {
          out.updated += r.updated
          out.notified += r.notified
        }
      } catch (err) {
        if (!(err instanceof GithubApiError)) throw err
        out.failed += 1
        if (err.status === 401 || err.status === 403) {
          out.stopped = true
          return out
        }
      }
    }
  }
  return out
}

export type GithubWebhookOutcome =
  | { ok: false; reason: 'bad_signature' | 'bad_json' }
  | ({ ok: true; change: GithubChange['kind'] } & SyncResult)

/**
 * One delivery to `/api/github/webhook`: checks `X-Hub-Signature-256` against the raw body,
 * reads the event and applies it. Retries are safe (every change is idempotent).
 */
export async function handleGithubWebhook(
  db: Db,
  delivery: { event: string; rawBody: string; signature: string | null },
  cfg: { secret: string; repo: string | GithubRepos; deps: BugReportSyncDeps },
): Promise<GithubWebhookOutcome> {
  if (!verifyGithubSignature(cfg.secret, delivery.rawBody, delivery.signature)) {
    return { ok: false, reason: 'bad_signature' }
  }
  let payload: unknown
  try {
    payload = JSON.parse(delivery.rawBody)
  } catch {
    return { ok: false, reason: 'bad_json' }
  }
  const change = readGithubEvent(delivery.event, payload, cfg.repo)
  const result = await applyGithubChange(db, change, cfg.deps)
  return { ok: true, change: change.kind, ...result }
}
