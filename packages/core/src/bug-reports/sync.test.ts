/** SOURCE OF TRUTH: GitHub → bug report mapping tests — the webhook signature check, every event the webhook reads, the status rules and which comments the reporter may see */
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  latestVisibleReply,
  nextBugReportStatus,
  readGithubEvent,
  statusFromIssue,
  verifyGithubSignature,
} from './sync'

const REPO = 'Viora-Tech/e-commerce'
const repository = { full_name: REPO }
const sign = (secret: string, body: string) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

describe('verifyGithubSignature', () => {
  const secret = 'webhook-secret-for-tests-only'
  const body = '{"action":"closed"}'

  it('accepts the HMAC GitHub sends', () => {
    expect(verifyGithubSignature(secret, body, sign(secret, body))).toBe(true)
  })

  it('refuses a wrong secret, a changed body, a missing or malformed header, or no secret', () => {
    expect(verifyGithubSignature(secret, body, sign('another-secret-entirely', body))).toBe(false)
    expect(verifyGithubSignature(secret, `${body} `, sign(secret, body))).toBe(false)
    expect(verifyGithubSignature(secret, body, null)).toBe(false)
    expect(verifyGithubSignature(secret, body, 'sha1=abc')).toBe(false)
    expect(verifyGithubSignature(secret, body, 'sha256=nothex')).toBe(false)
    expect(verifyGithubSignature(undefined, body, sign(secret, body))).toBe(false)
  })
})

describe('readGithubEvent: issues', () => {
  const issues = (action: string, issue: object, extra: object = {}) =>
    readGithubEvent(
      'issues',
      { action, issue: { number: 42, ...issue }, repository, ...extra },
      REPO,
    )

  it('closed as completed is fixed, closed as not planned is won’t fix', () => {
    expect(
      issues('closed', { state_reason: 'completed', closed_at: '2026-10-26T10:00:00Z' }),
    ).toEqual({
      kind: 'issue_status',
      issue: 42,
      status: 'fixed',
      reopened: false,
      closedAt: '2026-10-26T10:00:00Z',
    })
    expect(issues('closed', { state_reason: 'not_planned' })).toMatchObject({ status: 'wont_fix' })
  })

  it('reopened is in progress (and says it was a reopen)', () => {
    expect(issues('reopened', {})).toMatchObject({ status: 'in_progress', reopened: true })
  })

  it('the in-progress and wontfix labels move the status; other labels do not', () => {
    expect(issues('labeled', {}, { label: { name: 'in-progress' } })).toMatchObject({
      status: 'in_progress',
      reopened: false,
    })
    expect(issues('labeled', {}, { label: { name: 'wontfix' } })).toMatchObject({
      status: 'wont_fix',
    })
    expect(issues('labeled', {}, { label: { name: 'bug' } }).kind).toBe('ignore')
    expect(issues('opened', {}).kind).toBe('ignore')
  })

  it('ignores another repository', () => {
    const change = readGithubEvent(
      'issues',
      { action: 'closed', issue: { number: 1 }, repository: { full_name: 'someone/else' } },
      REPO,
    )
    expect(change).toEqual({ kind: 'ignore', reason: 'another repository' })
  })
})

describe('readGithubEvent: issue_comment', () => {
  const comment = (action: string, c: object, issue: object = {}) =>
    readGithubEvent(
      'issue_comment',
      {
        action,
        issue: { number: 7, ...issue },
        comment: { id: 99, created_at: '2026-10-26T09:00:00Z', ...c },
        repository,
      },
      REPO,
    )

  it('a team member’s comment becomes the reply, scrubbed of secrets', () => {
    const change = comment('created', {
      author_association: 'MEMBER',
      body: 'Fixed it. token=ghp_abcdefghijklmnopqrstuvwxyz0123 was wrong.',
    })
    expect(change).toEqual({
      kind: 'reply',
      issue: 7,
      commentId: '99',
      body: 'Fixed it. token=[redacted] was wrong.',
      at: '2026-10-26T09:00:00Z',
    })
  })

  it('internal comments, outsiders and pull requests are never shown', () => {
    expect(
      comment('created', { author_association: 'OWNER', body: 'internal: PII here' }).kind,
    ).toBe('ignore')
    expect(comment('created', { author_association: 'NONE', body: 'me too' }).kind).toBe('ignore')
    expect(
      comment('created', { author_association: 'MEMBER', body: 'hi' }, { pull_request: {} }).kind,
    ).toBe('ignore')
  })

  it('editing a comment to internal, or deleting it, clears that reply', () => {
    expect(
      comment('edited', { author_association: 'MEMBER', body: 'Internal: oops' }),
    ).toMatchObject({
      kind: 'reply',
      body: null,
    })
    expect(comment('deleted', { author_association: 'MEMBER', body: 'x' })).toMatchObject({
      kind: 'reply',
      body: null,
    })
  })
})

describe('readGithubEvent: releases', () => {
  it('a push to main is a release carrying its commits', () => {
    const change = readGithubEvent(
      'push',
      {
        ref: 'refs/heads/main',
        after: 'abc123',
        commits: [{ id: 'c1' }, { id: 'c2' }],
        repository,
      },
      REPO,
    )
    expect(change).toEqual({ kind: 'release', head: 'abc123', commits: ['c1', 'c2'] })
  })

  it('a push elsewhere, or a deleted branch, is not', () => {
    expect(
      readGithubEvent('push', { ref: 'refs/heads/dev', after: 'a', repository }, REPO).kind,
    ).toBe('ignore')
    expect(
      readGithubEvent('push', { ref: 'refs/heads/main', after: '0000000', repository }, REPO).kind,
    ).toBe('ignore')
  })

  it('a pull request merged into main is a release; one into dev or unmerged is not', () => {
    const pr = (merged: boolean, base: string) =>
      readGithubEvent(
        'pull_request',
        {
          action: 'closed',
          pull_request: { merged, base: { ref: base }, merge_commit_sha: 'm1' },
          repository,
        },
        REPO,
      )
    expect(pr(true, 'main')).toEqual({ kind: 'release', head: 'm1', commits: [] })
    expect(pr(true, 'dev').kind).toBe('ignore')
    expect(pr(false, 'main').kind).toBe('ignore')
  })

  it('other events are ignored', () => {
    expect(readGithubEvent('ping', { zen: 'hi' }, REPO).kind).toBe('ignore')
  })
})

describe('nextBugReportStatus', () => {
  it('keeps the same status as no change (idempotent)', () => {
    expect(nextBugReportStatus('fixed', 'fixed')).toBeNull()
  })

  it('never steps live back to fixed, and keeps won’t fix through a plain close', () => {
    expect(nextBugReportStatus('live', 'fixed')).toBeNull()
    expect(nextBugReportStatus('wont_fix', 'fixed')).toBeNull()
    expect(nextBugReportStatus('in_progress', 'fixed')).toBe('fixed')
  })

  it('a late in-progress label does not reopen; a reopen always does', () => {
    expect(nextBugReportStatus('received', 'in_progress')).toBe('in_progress')
    expect(nextBugReportStatus('fixed', 'in_progress')).toBeNull()
    expect(nextBugReportStatus('live', 'in_progress', { reopened: true })).toBe('in_progress')
  })

  it('only fixed reports go live', () => {
    expect(nextBugReportStatus('fixed', 'live')).toBe('live')
    expect(nextBugReportStatus('received', 'live')).toBeNull()
  })
})

describe('statusFromIssue', () => {
  const issue = (
    state: 'open' | 'closed',
    labels: string[] = [],
    stateReason: string | null = null,
  ) => ({
    state,
    labels,
    stateReason,
  })

  it('reads the issue’s state the way the webhook would', () => {
    expect(statusFromIssue('received', issue('open'))).toBe('received')
    expect(statusFromIssue('received', issue('open', ['In-Progress']))).toBe('in_progress')
    expect(statusFromIssue('in_progress', issue('closed'))).toBe('fixed')
    expect(statusFromIssue('in_progress', issue('closed', [], 'not_planned'))).toBe('wont_fix')
    expect(statusFromIssue('received', issue('open', ['wontfix']))).toBe('wont_fix')
    expect(statusFromIssue('fixed', issue('open'))).toBe('in_progress')
  })
})

describe('replies', () => {
  it('shows only the team’s non-internal comments', () => {
    const one = (body: string, authorAssociation: string) =>
      latestVisibleReply([{ id: 1, body, authorAssociation, createdAt: '2026-10-26T00:00:00Z' }])
        ?.body ?? null
    expect(one('Thanks!', 'COLLABORATOR')).toBe('Thanks!')
    expect(one('  INTERNAL: no', 'OWNER')).toBeNull()
    expect(one('hi', 'CONTRIBUTOR')).toBeNull()
    expect(one('   ', 'OWNER')).toBeNull()
  })

  it('picks the latest visible comment by when it was posted', () => {
    const reply = latestVisibleReply([
      { id: 1, body: 'First look', authorAssociation: 'MEMBER', createdAt: '2026-10-25T00:00:00Z' },
      {
        id: 2,
        body: 'internal: hmm',
        authorAssociation: 'MEMBER',
        createdAt: '2026-10-27T00:00:00Z',
      },
      { id: 3, body: 'Fixed', authorAssociation: 'OWNER', createdAt: '2026-10-26T00:00:00Z' },
      { id: 4, body: 'me too', authorAssociation: 'NONE', createdAt: '2026-10-28T00:00:00Z' },
    ])
    expect(reply).toEqual({ commentId: '3', body: 'Fixed', at: '2026-10-26T00:00:00Z' })
    expect(latestVisibleReply([])).toBeNull()
  })
})
