/** SOURCE OF TRUTH: bug report status tests — WHAT: a report is stored when filed, GitHub webhook deliveries and the poll move its status and reply idempotently, a release to main marks fixes live, and the reporter's unread dot, bell, email and WhatsApp follow the reporter's choice / WHY: the reporter only sees the admin, so it must agree with GitHub without double-notifying */
import { createHmac } from 'node:crypto'
import {
  authSchema,
  bugReport,
  createDb,
  notification,
  store,
  storeMember,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { loadActivityFeed } from '../activity/feed'
import { parseMemberAlertPrefs } from '../member-account/alert-prefs'
import { listRoles, seedSystemRoles, upsertMember } from '../permissions/service'
import { githubClient } from './github'
import { type BugReportSyncDeps, handleGithubWebhook, pollBugReports } from './github-sync'
import {
  countUnreadBugReports,
  listBugReports,
  markBugReportsSeen,
  recordBugReport,
} from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const REPO = 'Viora-Tech/e-commerce'
const SECRET = 'webhook-secret-for-tests-only'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

type Call = { method: string; path: string; body: unknown }

/**
 * Stands in for api.github.com: one issue's state, comments and closing commit, which commits
 * main contains, and every request recorded. Never reaches the network.
 */
function fakeGithub() {
  const state = {
    issue: {
      state: 'open',
      state_reason: null as string | null,
      labels: [] as string[],
      closed_at: null as string | null,
    },
    comments: [] as {
      id: number
      body: string
      author_association: string
      created_at: string
      updated_at: string
    }[],
    closingCommit: null as string | null,
    onMain: new Set<string>(),
    fail: null as number | null,
  }
  const calls: Call[] = []
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.pathname.replace(`/repos/${REPO}`, '')
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ method, path, body })
    if (state.fail) return new Response('{}', { status: state.fail })
    const json = (v: unknown, status = 200) =>
      new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } })
    if (/^\/issues\/\d+$/.test(path) && method === 'GET') {
      return json({
        number: 1,
        ...state.issue,
        labels: state.issue.labels.map((name) => ({ name })),
      })
    }
    if (path.endsWith('/comments') && method === 'GET') return json(state.comments)
    if (path.endsWith('/comments') && method === 'POST') {
      return json({ id: 5001, created_at: '2026-10-27T08:00:00Z' }, 201)
    }
    if (path.endsWith('/events')) {
      return json(state.closingCommit ? [{ event: 'closed', commit_id: state.closingCommit }] : [])
    }
    if (path.startsWith('/compare/')) {
      const sha = decodeURIComponent(path.slice('/compare/'.length).split('...')[0] ?? '')
      return json({ status: state.onMain.has(sha) ? 'ahead' : 'diverged' })
    }
    if (method === 'DELETE') return new Response(null, { status: 404 })
    return json({})
  }) as typeof fetch
  return { state, calls, github: githubClient({ fetch: fetchFn, token: 'test-token', repo: REPO }) }
}

function fakeEmail() {
  const sent: Message[] = []
  const channel: NotificationChannel = {
    id: 'platform_email',
    label: 'Email',
    requires: 'email',
    async send(m) {
      sent.push(m)
      return { ok: true, providerRef: `ses-${sent.length}` }
    },
  }
  return {
    sent,
    notify: {
      adminUrl: 'https://admin.example.com',
      platform: {
        transport: {
          fromEmail: 'no-reply@example.com',
          fromName: 'Koomerce',
          channel: () => channel,
        },
      },
    },
  }
}

/** A store with an owner ("Your bug reports" email on by default for both) and a staff member, plus one report each. */
async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const storeId = s.id
  await owner.insert(authSchema.user).values([
    { id: 'u-owner', email: 'owner@example.com', name: 'Owner' },
    { id: 'u-staff', email: 'staff@example.com', name: 'Staff' },
  ])
  await withStore(owner, storeId, async (tx) => {
    await seedSystemRoles(tx, storeId)
    const roles = await listRoles(tx, storeId)
    const roleOf = (slug: string) => roles.find((r) => r.slug === slug)?.id as string
    await upsertMember(tx, { storeId, userId: 'u-owner', roleId: roleOf('owner') })
    await upsertMember(tx, { storeId, userId: 'u-staff', roleId: roleOf('staff') })
  })
  const file = (userId: string, email: string, issue: number) =>
    withStore(app, storeId, (tx) =>
      recordBugReport(tx, storeId, {
        reporterUserId: userId,
        reporterEmail: email,
        reporterName: userId,
        title: `Save does nothing (${issue})`,
        description: '',
        page: '/products',
        screenshotUrl: null,
        githubIssueNumber: issue,
        githubIssueUrl: `https://github.com/${REPO}/issues/${issue}`,
      }),
    )
  const ownerReport = await file('u-owner', 'owner@example.com', 11)
  const staffReport = await file('u-staff', 'staff@example.com', 12)
  return { storeId, ownerReport, staffReport }
}

const deliver = (event: string, payload: object, deps: BugReportSyncDeps, secret = SECRET) => {
  const rawBody = JSON.stringify({ repository: { full_name: REPO }, ...payload })
  const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
  return handleGithubWebhook(
    app,
    { event, rawBody, signature },
    { secret: SECRET, repo: REPO, deps },
  )
}

const row = async (storeId: string, id: string) => {
  const [r] = await withStore(owner, storeId, (tx) =>
    tx.select().from(bugReport).where(eq(bugReport.id, id)),
  )
  if (!r) throw new Error('no report')
  return r
}

describe('My reports', () => {
  it('lists the member’s own reports; the owner can list the whole store', async () => {
    const { storeId } = await seed()
    const mine = await withStore(app, storeId, (tx) =>
      listBugReports(tx, { userId: 'u-staff', scope: 'mine' }),
    )
    expect(mine.map((r) => r.title)).toEqual(['Save does nothing (12)'])
    expect(mine[0]).toMatchObject({ status: 'received', mine: true, unread: false })
    const all = await withStore(app, storeId, (tx) =>
      listBugReports(tx, { userId: 'u-owner', scope: 'store' }),
    )
    expect(all).toHaveLength(2)
  })
})

describe('GitHub webhook', () => {
  it('refuses a bad signature and changes nothing', async () => {
    const { storeId, staffReport } = await seed()
    const out = await deliver(
      'issues',
      { action: 'closed', issue: { number: 12, state_reason: 'completed' } },
      { github: null, notify: null },
      'not-the-real-secret-value',
    )
    expect(out).toEqual({ ok: false, reason: 'bad_signature' })
    expect((await row(storeId, staffReport)).status).toBe('received')
  })

  it('moves status, stores the fix commit, marks it unread, lists it in the bell, and only once', async () => {
    const { storeId, staffReport } = await seed()
    const gh = fakeGithub()
    gh.state.closingCommit = 'fix-sha-1'
    const deps = { github: gh.github, notify: null }

    await deliver(
      'issues',
      { action: 'labeled', label: { name: 'in-progress' }, issue: { number: 12 } },
      deps,
    )
    expect((await row(storeId, staffReport)).status).toBe('in_progress')

    const closed = {
      action: 'closed',
      issue: { number: 12, state_reason: 'completed', closed_at: '2026-10-26T10:00:00Z' },
    }
    const first = await deliver('issues', closed, deps)
    expect(first).toMatchObject({ ok: true, change: 'issue_status', updated: 1 })
    const again = await deliver('issues', closed, deps)
    expect(again).toMatchObject({ ok: true, updated: 0 })

    const r = await row(storeId, staffReport)
    expect(r).toMatchObject({ status: 'fixed', fixCommitSha: 'fix-sha-1' })
    expect(await withStore(app, storeId, (tx) => countUnreadBugReports(tx, 'u-staff'))).toBe(1)
    expect(await withStore(app, storeId, (tx) => countUnreadBugReports(tx, 'u-owner'))).toBe(0)

    const feed = await withStore(app, storeId, (tx) =>
      loadActivityFeed(tx, storeId, () => false, 'u-staff'),
    )
    expect(feed.events).toEqual([
      expect.objectContaining({ kind: 'bug_report', id: staffReport, status: 'fixed' }),
    ])

    await withStore(app, storeId, (tx) => markBugReportsSeen(tx, 'u-staff'))
    expect(await withStore(app, storeId, (tx) => countUnreadBugReports(tx, 'u-staff'))).toBe(0)
  })

  it('closed as not planned or labelled wontfix is won’t fix; reopening is in progress', async () => {
    const { storeId, staffReport, ownerReport } = await seed()
    const deps = { github: null, notify: null }
    await deliver(
      'issues',
      { action: 'closed', issue: { number: 12, state_reason: 'not_planned' } },
      deps,
    )
    expect((await row(storeId, staffReport)).status).toBe('wont_fix')
    await deliver('issues', { action: 'reopened', issue: { number: 12 } }, deps)
    expect((await row(storeId, staffReport)).status).toBe('in_progress')
    await deliver(
      'issues',
      { action: 'labeled', label: { name: 'wontfix' }, issue: { number: 11 } },
      deps,
    )
    expect((await row(storeId, ownerReport)).status).toBe('wont_fix')
  })

  it('shows the team’s latest public comment, never an internal one, and clears it on delete', async () => {
    const { storeId, staffReport } = await seed()
    const deps = { github: null, notify: null }
    const comment = (action: string, id: number, body: string, at: string, who = 'MEMBER') =>
      deliver(
        'issue_comment',
        {
          action,
          issue: { number: 12 },
          comment: { id, body, author_association: who, created_at: at },
        },
        deps,
      )

    await comment('created', 1, 'Looking into it', '2026-10-26T09:00:00Z')
    await comment('created', 2, 'internal: customer phone is 9876543210', '2026-10-26T10:00:00Z')
    await comment('created', 3, 'me too', '2026-10-26T11:00:00Z', 'NONE')
    expect((await row(storeId, staffReport)).staffReply).toBe('Looking into it')

    await comment('edited', 1, 'Found it, password=hunter2 was logged', '2026-10-26T09:00:00Z')
    expect((await row(storeId, staffReport)).staffReply).toBe(
      'Found it, password=[redacted] was logged',
    )

    await comment('deleted', 1, '', '2026-10-26T09:00:00Z')
    expect((await row(storeId, staffReport)).staffReply).toBeNull()
  })

  it('a release to main marks fixes live: from the push’s commits, by compare, or closed by hand', async () => {
    const { storeId, staffReport, ownerReport } = await seed()
    const gh = fakeGithub()
    const mail = fakeEmail()
    const deps = { github: gh.github, notify: mail.notify }

    gh.state.closingCommit = 'fix-12'
    await deliver('issues', { action: 'closed', issue: { number: 12 } }, deps)
    gh.state.closingCommit = null
    await deliver('issues', { action: 'closed', issue: { number: 11 } }, deps)
    // "Your bug reports" email is on by default for every member, staff included.
    expect(mail.sent.map((m) => m.to.email)).toEqual(['staff@example.com', 'owner@example.com'])
    expect(mail.sent[0]).toMatchObject({
      template: 'bug_report_update',
      data: {
        bugReport: { status: 'fixed' },
        actionUrl: 'https://admin.example.com/account/bug-reports',
      },
    })

    const out = await deliver(
      'push',
      { ref: 'refs/heads/main', after: 'release-1', commits: [{ id: 'fix-12' }] },
      deps,
    )
    expect(out).toMatchObject({ ok: true, change: 'release', updated: 2 })
    expect((await row(storeId, staffReport)).status).toBe('live')
    expect((await row(storeId, ownerReport)).status).toBe('live')
    expect(mail.sent).toHaveLength(4)

    // The pull request event for the same release changes nothing more.
    const again = await deliver(
      'pull_request',
      {
        action: 'closed',
        pull_request: { merged: true, base: { ref: 'main' }, merge_commit_sha: 'release-1' },
      },
      deps,
    )
    expect(again).toMatchObject({ updated: 0 })
  })

  it('sends no email to a reporter who turned "Your bug reports" email off', async () => {
    const { storeId, staffReport } = await seed()
    await owner
      .update(storeMember)
      .set({
        notificationPrefs: {
          ...parseMemberAlertPrefs(null, false),
          bugReports: { email: false, whatsapp: false },
        },
      })
      .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, 'u-staff')))
    const mail = fakeEmail()
    await deliver(
      'issues',
      { action: 'closed', issue: { number: 12 } },
      { github: null, notify: mail.notify },
    )
    expect(mail.sent).toEqual([])
    expect((await row(storeId, staffReport)).status).toBe('fixed')
    expect((await row(storeId, staffReport)).fixCommitSha).toBeNull()
  })

  it('sends WhatsApp through the store’s channel when the reporter chose it and gave a mobile', async () => {
    const { storeId } = await seed()
    await owner
      .update(storeMember)
      .set({
        notificationPrefs: {
          ...parseMemberAlertPrefs(null, false),
          bugReports: { email: false, whatsapp: true },
        },
      })
      .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, 'u-staff')))
    const chats: Message[] = []
    const whatsapp: NotificationChannel = {
      id: 'whatsapp',
      label: 'WhatsApp',
      requires: 'phone',
      async send(m) {
        chats.push(m)
        return { ok: true, providerRef: 'wamid-1' }
      },
    }
    const mail = fakeEmail()
    const deps = {
      github: null,
      notify: { ...mail.notify, storeChannels: async () => [whatsapp] },
    }

    // No mobile on the profile yet: nothing goes on WhatsApp, and email is off.
    await deliver('issues', { action: 'closed', issue: { number: 12 } }, deps)
    expect(chats).toEqual([])

    await owner
      .update(authSchema.user)
      .set({ phone: '+919876543210' })
      .where(eq(authSchema.user.id, 'u-staff'))
    await deliver('issues', { action: 'reopened', issue: { number: 12 } }, deps)
    const out = await deliver('issues', { action: 'closed', issue: { number: 12 } }, deps)
    expect(out).toMatchObject({ ok: true, updated: 1, notified: 1 })
    expect(chats).toHaveLength(1)
    expect(chats[0]).toMatchObject({
      to: { phone: '919876543210' },
      template: 'bug_report_update',
      data: { bugReport: { status: 'fixed' } },
    })
    expect(mail.sent).toEqual([])
    const logged = await withStore(owner, storeId, (tx) =>
      tx.select().from(notification).where(eq(notification.template, 'bug_report_update')),
    )
    expect(logged).toMatchObject([{ channel: 'whatsapp', to: '919876543210', status: 'sent' }])
  })
})

describe('poll', () => {
  it('reads state, reply and whether the fix reached main; skips recent syncs; stops on 401', async () => {
    const { storeId, staffReport } = await seed()
    const gh = fakeGithub()
    gh.state.issue = {
      state: 'closed',
      state_reason: 'completed',
      labels: [],
      closed_at: '2026-10-26T10:00:00Z',
    }
    gh.state.closingCommit = 'fix-12'
    gh.state.onMain.add('fix-12')
    gh.state.comments = [
      {
        id: 9,
        body: 'Shipped',
        author_association: 'OWNER',
        created_at: '2026-10-26T11:00:00Z',
        updated_at: '2026-10-26T11:00:00Z',
      },
    ]
    const deps = { github: gh.github, notify: null }

    const out = await pollBugReports(app, deps, { budget: 1, minAgeMs: 10 * 60_000 })
    expect(out).toMatchObject({ checked: 1, failed: 0, stopped: false })

    const both = await withStore(owner, storeId, (tx) => tx.select().from(bugReport))
    const polled = both.find((r) => r.syncedAt !== null)
    expect(polled).toMatchObject({ status: 'live', fixCommitSha: 'fix-12', staffReply: 'Shipped' })

    // The second report is next; the first was synced moments ago and is skipped.
    gh.state.fail = 401
    const stopped = await pollBugReports(app, deps, { budget: 5, minAgeMs: 10 * 60_000 })
    expect(stopped).toMatchObject({ checked: 1, failed: 1, stopped: true })
    expect(both.map((r) => r.id)).toContain(staffReport)
  })
})
