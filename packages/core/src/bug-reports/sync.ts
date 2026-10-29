/** SOURCE OF TRUTH: GitHub → bug report mapping — WHAT: checks a webhook's X-Hub-Signature-256, reads the Issues / Issue comment / Push / Pull request payloads into one small change, and decides a report's next status and visible reply / WHY: pure, so the webhook, the worker's poll and the tests agree on every rule */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { BugReportStatus } from './client'
import { scrubSecrets } from './scrub'

/** The label that marks an issue as being worked on, and the one that marks it won't-fix. */
const IN_PROGRESS_LABEL = 'in-progress'
const WONT_FIX_LABEL = 'wontfix'

/** The branch a release lands on: a fix is "live" once its commit is in this branch's history. */
export const RELEASE_BRANCH = 'main'

/** Comments starting with this stay between the team (never shown to the reporter). */
const INTERNAL_PREFIX = /^\s*internal\s*:/i

/** Who counts as "the team" on GitHub. */
const MAINTAINER_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

/** Longest reply shown in the admin; GitHub comments can be far longer. */
const BUG_REPLY_MAX = 4000

/**
 * `X-Hub-Signature-256: sha256=<hex HMAC of the raw body>`. Constant-time; false for a missing,
 * malformed or wrong signature, or no secret.
 */
export function verifyGithubSignature(
  secret: string | undefined,
  rawBody: string,
  header: string | null,
): boolean {
  if (!secret || !header?.startsWith('sha256=')) return false
  const got = Buffer.from(header.slice('sha256='.length), 'hex')
  const want = createHmac('sha256', secret).update(rawBody, 'utf8').digest()
  return got.length === want.length && timingSafeEqual(got, want)
}

/** What one webhook delivery means for bug reports. */
export type GithubChange =
  | {
      kind: 'issue_status'
      issue: number
      /** What the event proposes; `nextBugReportStatus` decides whether it applies. */
      status: BugReportStatus
      /** A reopen moves any status back to in progress. */
      reopened: boolean
      /** Only on `closed`: GitHub's own time. */
      closedAt: string | null
    }
  | {
      kind: 'reply'
      issue: number
      commentId: string
      /** Null clears the reply (the comment it came from was deleted or turned internal). */
      body: string | null
      /** When the comment was first posted: a later edit of an older comment never jumps ahead. */
      at: string
    }
  | {
      kind: 'release'
      /** The new head of the release branch. */
      head: string
      /** Commit ids the push carried (empty for a merged pull request). */
      commits: string[]
    }
  | { kind: 'ignore'; reason: string }

type Json = Record<string, unknown>

const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {})
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)

/** The team's comment as the reporter will read it, or null when it must not be shown. */
function visibleReply(body: string, authorAssociation: string): string | null {
  if (!MAINTAINER_ASSOCIATIONS.has(authorAssociation)) return null
  if (INTERNAL_PREFIX.test(body)) return null
  const text = scrubSecrets(body.trim())
  if (!text) return null
  return text.length > BUG_REPLY_MAX ? `${text.slice(0, BUG_REPLY_MAX - 1)}…` : text
}

/**
 * Reads one delivery (`X-GitHub-Event` + parsed JSON) into a change. `repo` is the repository
 * reports are filed in: deliveries from anywhere else are ignored.
 */
export function readGithubEvent(event: string, payload: unknown, repo: string): GithubChange {
  const p = obj(payload)
  const fullName = str(obj(p.repository).full_name)
  if (fullName && fullName.toLowerCase() !== repo.toLowerCase()) {
    return { kind: 'ignore', reason: 'another repository' }
  }
  const action = str(p.action)

  if (event === 'issues') {
    const issue = obj(p.issue)
    const number = num(issue.number)
    if (number === null) return { kind: 'ignore', reason: 'no issue number' }
    if (action === 'closed') {
      const notPlanned = str(issue.state_reason) === 'not_planned'
      return {
        kind: 'issue_status',
        issue: number,
        status: notPlanned ? 'wont_fix' : 'fixed',
        reopened: false,
        closedAt: str(issue.closed_at),
      }
    }
    if (action === 'reopened') {
      return {
        kind: 'issue_status',
        issue: number,
        status: 'in_progress',
        reopened: true,
        closedAt: null,
      }
    }
    if (action === 'labeled') {
      const label = str(obj(p.label).name)?.toLowerCase()
      if (label === IN_PROGRESS_LABEL) {
        return {
          kind: 'issue_status',
          issue: number,
          status: 'in_progress',
          reopened: false,
          closedAt: null,
        }
      }
      if (label === WONT_FIX_LABEL) {
        return {
          kind: 'issue_status',
          issue: number,
          status: 'wont_fix',
          reopened: false,
          closedAt: null,
        }
      }
    }
    return { kind: 'ignore', reason: `issues.${action ?? 'unknown'}` }
  }

  if (event === 'issue_comment') {
    const issue = obj(p.issue)
    const number = num(issue.number)
    if (number === null || issue.pull_request) return { kind: 'ignore', reason: 'not an issue' }
    const comment = obj(p.comment)
    const id = num(comment.id)
    if (id === null) return { kind: 'ignore', reason: 'no comment id' }
    const association = str(comment.author_association) ?? 'NONE'
    if (!MAINTAINER_ASSOCIATIONS.has(association)) {
      return { kind: 'ignore', reason: 'not from the team' }
    }
    const at = str(comment.created_at) ?? new Date().toISOString()
    if (action === 'deleted') {
      return { kind: 'reply', issue: number, commentId: String(id), body: null, at }
    }
    if (action === 'created' || action === 'edited') {
      const body = visibleReply(str(comment.body) ?? '', association)
      // An edit that made the comment internal clears it; a new internal comment is ignored.
      if (body === null && action === 'created') return { kind: 'ignore', reason: 'internal' }
      return { kind: 'reply', issue: number, commentId: String(id), body, at }
    }
    return { kind: 'ignore', reason: `issue_comment.${action ?? 'unknown'}` }
  }

  if (event === 'push') {
    if (str(p.ref) !== `refs/heads/${RELEASE_BRANCH}`) return { kind: 'ignore', reason: 'not main' }
    const head = str(p.after)
    if (!head || /^0+$/.test(head)) return { kind: 'ignore', reason: 'branch deleted' }
    const commits = Array.isArray(p.commits)
      ? p.commits.map((c) => str(obj(c).id)).filter((c): c is string => c !== null)
      : []
    return { kind: 'release', head, commits }
  }

  if (event === 'pull_request') {
    const pr = obj(p.pull_request)
    const merged = pr.merged === true
    const baseRef = str(obj(pr.base).ref)
    const head = str(pr.merge_commit_sha)
    if (action !== 'closed' || !merged || baseRef !== RELEASE_BRANCH || !head) {
      return { kind: 'ignore', reason: 'not a merge into main' }
    }
    return { kind: 'release', head, commits: [] }
  }

  return { kind: 'ignore', reason: `event ${event}` }
}

/**
 * The status a report moves to when GitHub proposes `proposed`, or null to stay. Live never
 * steps back to fixed (a later close event repeats what is already shipped); a closed issue's
 * late "in-progress" label does not reopen it; won't-fix sticks through a plain close.
 * A reopen (`in_progress` from `reopened`) always applies, so pass `reopened: true` for it.
 */
export function nextBugReportStatus(
  current: BugReportStatus,
  proposed: BugReportStatus,
  opts: { reopened?: boolean } = {},
): BugReportStatus | null {
  if (current === proposed) return null
  if (opts.reopened) return proposed
  switch (proposed) {
    case 'in_progress':
      return current === 'received' ? proposed : null
    case 'fixed':
      return current === 'live' || current === 'wont_fix' ? null : proposed
    case 'live':
      return current === 'fixed' ? proposed : null
    default:
      return proposed
  }
}

/**
 * The status an issue's current state implies (the worker's poll, which sees state rather than
 * events). `current` decides the open cases: a report already past `received` that GitHub shows
 * open again was reopened.
 */
export function statusFromIssue(
  current: BugReportStatus,
  issue: { state: 'open' | 'closed'; stateReason: string | null; labels: string[] },
): BugReportStatus {
  const labels = issue.labels.map((l) => l.toLowerCase())
  if (labels.includes(WONT_FIX_LABEL) || issue.stateReason === 'not_planned') return 'wont_fix'
  if (issue.state === 'closed') return current === 'live' ? 'live' : 'fixed'
  if (labels.includes(IN_PROGRESS_LABEL)) return 'in_progress'
  return current === 'received' ? 'received' : 'in_progress'
}

/** The latest comment the reporter may see, from a list in any order. */
export function latestVisibleReply(
  comments: { id: number; body: string; authorAssociation: string; createdAt: string }[],
): { commentId: string; body: string; at: string } | null {
  const sorted = [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  for (const c of sorted) {
    const body = visibleReply(c.body, c.authorAssociation)
    if (body) return { commentId: String(c.id), body, at: c.createdAt }
  }
  return null
}
