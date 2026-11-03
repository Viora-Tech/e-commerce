import { readFileSync, rmSync } from 'node:fs'
import { createMerchantAuth } from '@commerce/auth'
import {
  createMemoryRateLimitStore,
  localStoragePath,
  type RateLimitStore,
  scrubSecrets,
} from '@commerce/core'
import { createDb, role, store, storeMember } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'
import { BUG_REPORT_RULE, githubIssueProblem } from '../src/services/bug-report.service'

/**
 * "Report a bug" (test server only): any signed-in member files a GitHub issue. These tests
 * never reach GitHub (every call gets an injected fetch) and never create a real issue.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const sent: { email: string; otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

type FetchCall = { url: string; init: RequestInit }

let limiter: RateLimitStore
let calls: FetchCall[]
let nextIssue: number

/** Stands in for api.github.com: records each request and answers like GitHub does. */
const fakeGithub = (async (input: string | URL | Request, init?: RequestInit) => {
  calls.push({ url: String(input), init: init ?? {} })
  nextIssue += 1
  return new Response(
    JSON.stringify({
      number: nextIssue,
      html_url: `https://github.com/Viora-Tech/e-commerce/issues/${nextIssue}`,
    }),
    { status: 201, headers: { 'content-type': 'application/json' } },
  )
}) as typeof fetch

function ctx(headers: Headers): ApiContext {
  return {
    db: app,
    auth,
    headers,
    notifications: { add: async () => undefined },
    rateLimit: limiter,
    githubFetch: fakeGithub,
  }
}

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  const organizationId = org?.id as string
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: 'Waimers Test', organizationId })
    .returning()
  if (!s) throw new Error('seed')
  return { headers, organizationId, storeId: s.id }
}

/** A member on the system `staff` role, which has no `settings.read`. */
async function staff(storeId: string, organizationId: string, ownerHeaders: Headers) {
  await call(appRouter.staff.me, {}, { context: ctx(ownerHeaders) }) // seeds the roles
  const headers = await signIn('helper@example.com')
  const session = await auth.api.getSession({ headers })
  const userId = session?.user.id as string
  await auth.api.addMember({ body: { userId, role: 'member', organizationId } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [r] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, storeId), eq(role.slug, 'staff')))
  if (!r) throw new Error('no staff role')
  const [m] = await owner
    .select()
    .from(storeMember)
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  if (m) await owner.update(storeMember).set({ roleId: r.id }).where(eq(storeMember.id, m.id))
  else await owner.insert(storeMember).values({ storeId, userId, roleId: r.id })
  return headers
}

const report = {
  summary: 'Save button does nothing',
  details: 'I changed the price and pressed Save',
  path: '/products/abc?tab=pricing',
  viewport: '1440x900',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/141',
  recentErrors: ['TypeError: cannot read properties of undefined (reading "id")'],
}

/** A real 1x1 PNG, as the browser's canvas would hand it over. */
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const ENV_KEYS = [
  'BUG_REPORTS_ENABLED',
  'GITHUB_ISSUES_TOKEN',
  'GITHUB_ISSUES_REPO',
  'GITHUB_CODE_REPO',
] as const
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))

function enable(token: string | null = 'github_pat_test_only') {
  process.env.BUG_REPORTS_ENABLED = 'true'
  if (token) process.env.GITHUB_ISSUES_TOKEN = token
  else delete process.env.GITHUB_ISSUES_TOKEN
  delete process.env.GITHUB_ISSUES_REPO
  delete process.env.GITHUB_CODE_REPO
}

function sentIssue(i = 0) {
  const c = calls[i]
  if (!c) throw new Error('GitHub was not called')
  return {
    url: c.url,
    headers: new Headers(c.init.headers),
    body: JSON.parse(String(c.init.body)) as { title: string; body: string; labels: string[] },
  }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
  calls = []
  nextIssue = 122
  limiter = createMemoryRateLimitStore()
  for (const k of ENV_KEYS) delete process.env[k]
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('bugReports.create', () => {
  it('is refused while the server has bug reports off', async () => {
    const a = await merchant('owner@example.com', 'bugs-a')
    await expect(
      call(appRouter.bugReports.create, report, { context: ctx(a.headers) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(calls).toHaveLength(0)
  })

  it('files one GitHub issue with the report, the store and the reporter', async () => {
    enable()
    const a = await merchant('owner@example.com', 'bugs-a')
    const result = await call(appRouter.bugReports.create, report, { context: ctx(a.headers) })

    expect(result).toEqual({
      number: 123,
      url: 'https://github.com/Viora-Tech/e-commerce/issues/123',
      logged: false,
    })
    expect(calls).toHaveLength(1)
    const issue = sentIssue()
    expect(issue.url).toBe('https://api.github.com/repos/Viora-Tech/e-commerce/issues')
    expect(calls[0]?.init.method).toBe('POST')
    expect(issue.headers.get('authorization')).toBe('Bearer github_pat_test_only')
    expect(issue.headers.get('accept')).toBe('application/vnd.github+json')
    expect(issue.headers.get('x-github-api-version')).toBe('2022-11-28')
    expect(issue.body.labels).toEqual(['bug', 'test-server'])
    expect(issue.body.title).toBe('Save button does nothing')
    const body = issue.body.body
    expect(body).toContain('I changed the price and pressed Save')
    expect(body).toContain('/products/abc?tab=pricing')
    expect(body).toContain('Waimers Test')
    expect(body).toContain(a.storeId)
    expect(body).toContain('owner@example.com')
    expect(body).toContain('Owner')
    expect(body).toContain('1440x900')
    expect(body).toContain('Chrome/141')
    expect(body).toContain('cannot read properties of undefined')
    expect(body).toMatch(/IST/)
    expect(body).toMatch(/Commit \| `[^`]+`/)
  })

  it('files in GITHUB_ISSUES_REPO when set', async () => {
    enable()
    process.env.GITHUB_ISSUES_REPO = 'someone/elsewhere'
    const a = await merchant('owner@example.com', 'bugs-a')
    await call(appRouter.bugReports.create, report, { context: ctx(a.headers) })
    expect(sentIssue().url).toBe('https://api.github.com/repos/someone/elsewhere/issues')
  })

  it('in a public issues repository, leaves out the store, the reporter, the screenshot and ids', async () => {
    enable()
    process.env.GITHUB_ISSUES_REPO = 'Viora-Tech/koomerce-issues'
    const a = await merchant('owner@example.com', 'bugs-a')
    const orderId = '3f1c2b9a-0d4e-4c8b-9a71-2e5f6a7b8c9d'
    await call(
      appRouter.bugReports.create,
      { ...report, path: `/orders/${orderId}?tab=items`, screenshot: PNG_1PX },
      { context: ctx(a.headers) },
    )
    const { url, body } = sentIssue()
    expect(url).toBe('https://api.github.com/repos/Viora-Tech/koomerce-issues/issues')
    expect(body.title).toBe('Save button does nothing')
    expect(body.body).toContain('I changed the price and pressed Save')
    expect(body.body).toContain('`/orders/:id`')
    expect(body.body).toContain('Chrome/141')
    for (const secret of [orderId, 'tab=items', a.storeId, 'Waimers Test', 'owner@example.com']) {
      expect(body.body).not.toContain(secret)
    }
    expect(body.body).not.toMatch(/!\[[^\]]*\]\(/)
    // The screenshot is still kept with the report, for My reports.
    const mine = await call(
      appRouter.bugReports.list,
      { scope: 'mine' },
      { context: ctx(a.headers) },
    )
    expect(mine.reports[0]?.screenshotUrl).toBeTruthy()
  })

  it('lets staff without settings.read report too', async () => {
    enable()
    const a = await merchant('owner@example.com', 'bugs-a')
    const helper = await staff(a.storeId, a.organizationId, a.headers)
    await expect(
      call(appRouter.store.current, undefined, { context: ctx(helper) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const result = await call(appRouter.bugReports.create, report, { context: ctx(helper) })
    expect(result.number).toBe(123)
    expect(sentIssue().body.body).toContain('helper@example.com')
    expect(sentIssue().body.body).toContain('Staff')
  })

  it('keeps each report for My reports: own reports for staff, the whole store for the owner', async () => {
    enable()
    const a = await merchant('owner@example.com', 'bugs-a')
    const helper = await staff(a.storeId, a.organizationId, a.headers)
    await call(appRouter.bugReports.create, report, { context: ctx(a.headers) })
    await call(
      appRouter.bugReports.create,
      { ...report, summary: 'Helper: token=abc123 breaks' },
      { context: ctx(helper) },
    )

    const mine = await call(appRouter.bugReports.list, { scope: 'mine' }, { context: ctx(helper) })
    expect(mine.canSeeStore).toBe(false)
    expect(mine.reports).toHaveLength(1)
    expect(mine.reports[0]).toMatchObject({
      title: 'Helper: token=[redacted] breaks',
      status: 'received',
      githubIssueNumber: 124,
      page: '/products/abc?tab=pricing',
      mine: true,
      unread: false,
    })
    await expect(
      call(appRouter.bugReports.list, { scope: 'store' }, { context: ctx(helper) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const store = await call(
      appRouter.bugReports.list,
      { scope: 'store' },
      { context: ctx(a.headers) },
    )
    expect(store.canSeeStore).toBe(true)
    expect(store.reports).toHaveLength(2)

    expect(
      await call(appRouter.bugReports.unreadCount, undefined, { context: ctx(helper) }),
    ).toEqual({ count: 0 })
    expect(await call(appRouter.bugReports.markSeen, undefined, { context: ctx(helper) })).toEqual({
      ok: true,
    })
  })

  it('without a token (development) logs the would-be issue and never calls GitHub', async () => {
    enable(null)
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const a = await merchant('owner@example.com', 'bugs-a')
    const result = await call(appRouter.bugReports.create, report, { context: ctx(a.headers) })
    expect(result).toEqual({ number: null, url: null, logged: true })
    expect(calls).toHaveLength(0)
    const printed = log.mock.calls.flat().join('\n')
    expect(printed).toContain('Save button does nothing')
    expect(printed).toContain('I changed the price and pressed Save')
  })

  it('scrubs tokens, codes and secrets from everything the member typed or the page sent', async () => {
    enable()
    const a = await merchant('owner@example.com', 'bugs-a')
    await call(
      appRouter.bugReports.create,
      {
        ...report,
        summary: 'Login code 482913 did not work',
        details: 'Header was Authorization: Bearer abcDEF123456.ghi-jkl and api_key=sk_live_51Hx',
        path: '/settings/payments?token=s3cr3tvalue&tab=1',
        recentErrors: [
          'Failed: password=hunter2 at /api',
          `hash ${'a1b2c3d4'.repeat(6)} rejected`,
          `jwt ${'eyJhbGciOiJIUzI1NiJ9AbCdEfGhIjKlMnOpQrStUvWx'}`,
        ],
      },
      { context: ctx(a.headers) },
    )
    const { title, body } = sentIssue().body
    const all = `${title}\n${body}`
    for (const secret of [
      '482913',
      'abcDEF123456.ghi-jkl',
      'sk_live_51Hx',
      's3cr3tvalue',
      'hunter2',
      'a1b2c3d4'.repeat(6),
      'eyJhbGciOiJIUzI1NiJ9AbCdEfGhIjKlMnOpQrStUvWx',
    ]) {
      expect(all).not.toContain(secret)
    }
    expect(all).toContain('[redacted]')
    // What is not a secret survives.
    expect(all).toContain('did not work')
    expect(all).toContain('tab=1')
  })

  it('stops a member after the hourly budget, without calling GitHub again', async () => {
    enable()
    const a = await merchant('owner@example.com', 'bugs-a')
    for (let i = 0; i < BUG_REPORT_RULE.limit; i++) {
      await call(appRouter.bugReports.create, report, { context: ctx(a.headers) })
    }
    await expect(
      call(appRouter.bugReports.create, report, { context: ctx(a.headers) }),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
    expect(calls).toHaveLength(BUG_REPORT_RULE.limit)
  })

  it('uploads the screenshot through the store storage and links it in the issue', async () => {
    enable()
    const a = await merchant('owner@example.com', 'bugs-a')
    await call(
      appRouter.bugReports.create,
      { ...report, screenshot: PNG_1PX },
      { context: ctx(a.headers) },
    )
    const body = sentIssue().body.body
    const match = body.match(/!\[[^\]]*\]\((\S+)\)/)
    expect(match).not.toBeNull()
    const url = match?.[1] as string
    const key = url.split('/uploads/')[1] as string
    expect(key).toMatch(new RegExp(`^stores/${a.storeId}/bug-reports/[0-9a-f-]{36}\\.png$`))
    const path = localStoragePath(key)
    const written = readFileSync(path)
    expect(written.subarray(1, 4).toString()).toBe('PNG')
    rmSync(path)
  })

  it('refuses a screenshot that is not a PNG or JPEG', async () => {
    enable()
    const a = await merchant('owner@example.com', 'bugs-a')
    await expect(
      call(
        appRouter.bugReports.create,
        { ...report, screenshot: 'data:image/png;base64,PHN2Zz48L3N2Zz4=' },
        { context: ctx(a.headers) },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(calls).toHaveLength(0)
  })

  it('refuses oversized input', async () => {
    enable()
    const a = await merchant('owner@example.com', 'bugs-a')
    const context = { context: ctx(a.headers) }
    await expect(
      call(appRouter.bugReports.create, { ...report, summary: 'x'.repeat(201) }, context),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      call(appRouter.bugReports.create, { ...report, summary: '   ' }, context),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      call(
        appRouter.bugReports.create,
        { ...report, recentErrors: Array.from({ length: 21 }, () => 'e') },
        context,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      call(appRouter.bugReports.create, { ...report, recentErrors: ['e'.repeat(501)] }, context),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(calls).toHaveLength(0)
  })

  it('says so plainly when GitHub refuses, without echoing the token', async () => {
    enable()
    const a = await merchant('owner@example.com', 'bugs-a')
    const refusing = (async () =>
      new Response('{"message":"Bad credentials"}', { status: 401 })) as unknown as typeof fetch
    const error = await call(appRouter.bugReports.create, report, {
      context: { ...ctx(a.headers), githubFetch: refusing },
    }).catch((e: unknown) => e as { code: string; message: string })
    expect(error).toMatchObject({ code: 'BAD_GATEWAY' })
    expect(error).toMatchObject({ message: expect.stringContaining('wrong or has expired') })
    expect(JSON.stringify(error)).not.toContain('github_pat_test_only')
  })
})

describe('githubIssueProblem', () => {
  it('names the fix for token problems and keeps "try again" for outages', () => {
    const repo = 'Viora-Tech/e-commerce'
    expect(githubIssueProblem(401, repo)).toContain('wrong or has expired')
    expect(githubIssueProblem(403, repo)).toContain('cannot create issues in Viora-Tech/e-commerce')
    expect(githubIssueProblem(404, repo)).toContain('Issues: Read and write')
    expect(githubIssueProblem(422, repo)).toContain('labels')
    expect(githubIssueProblem(null, repo)).toContain('could not be reached')
    expect(githubIssueProblem(502, repo)).toBe(
      'GitHub did not take the report. Try again in a minute.',
    )
  })
})

describe('scrubSecrets', () => {
  it('redacts key=value pairs, bearer tokens, OTP codes and long hex or base64', () => {
    expect(scrubSecrets('token=abc123&page=2')).toBe('token=[redacted]&page=2')
    expect(scrubSecrets('"apiKey": "xyz789"')).toBe('"apiKey": "[redacted]"')
    expect(scrubSecrets('Bearer abc.def-ghi')).toBe('Bearer [redacted]')
    expect(scrubSecrets('your code is 123456')).toBe('your code is [redacted]')
    expect(scrubSecrets('OTP: 654321')).toBe('OTP: [redacted]')
    expect(scrubSecrets('123456 is your login code')).toBe('[redacted] is your login code')
    expect(scrubSecrets(`id ${'f'.repeat(40)}`)).toBe('id [redacted]')
  })

  it('keeps ordinary text, order numbers, ids and slugs', () => {
    const plain =
      'Order #1042 for ₹7,500 on /products/wireless-gaming-mouse-pro-edition-black-2026 failed'
    expect(scrubSecrets(plain)).toBe(plain)
    const uuid = '3f2c8a4e-9b1d-4c6e-8f00-123456789abc'
    expect(scrubSecrets(`store ${uuid}`)).toBe(`store ${uuid}`)
  })
})
