import { createMerchantAuth } from '@commerce/auth'
import { createDb, customer, role, store, storeMember } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const sent: { otp: string }[] = []
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

const ctx = (headers: Headers) =>
  ({ db: app, auth, headers, notifications: { add: async () => undefined } }) as ApiContext

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  return { ctx: ctx(headers), storeId: s?.id as string, orgId: org?.id as string }
}

async function staffMember(boss: { storeId: string; orgId: string; ctx: ApiContext }) {
  await call(appRouter.staff.me, {}, { context: boss.ctx })
  const headers = await signIn('helper@example.com')
  const helperId = (await auth.api.getSession({ headers }))?.user.id as string
  await auth.api.addMember({
    body: { userId: helperId, role: 'member', organizationId: boss.orgId },
  })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: boss.orgId } })
  const [staff] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, boss.storeId), eq(role.slug, 'staff')))
  const [existing] = await owner
    .select()
    .from(storeMember)
    .where(and(eq(storeMember.storeId, boss.storeId), eq(storeMember.userId, helperId)))
  if (existing) {
    await owner
      .update(storeMember)
      .set({ roleId: staff?.id as string })
      .where(eq(storeMember.id, existing.id))
  } else {
    await owner
      .insert(storeMember)
      .values({ storeId: boss.storeId, userId: helperId, roleId: staff?.id as string })
  }
  return ctx(headers)
}

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

describe('customer privacy API', () => {
  it('logs a request, exports, erases and closes it, with the staff member in the trail', async () => {
    const boss = await merchant('owner@example.com', 'waimers')
    const [cu] = await owner
      .insert(customer)
      .values({ storeId: boss.storeId, email: 'asha@example.com', name: 'Asha Rao' })
      .returning()
    const customerId = cu?.id as string

    const request = await call(
      appRouter.customerPrivacy.createRequest,
      { kind: 'delete', source: 'email', customerId, note: 'Wrote in on Monday' },
      { context: boss.ctx },
    )
    expect(request).toMatchObject({ number: 1, status: 'open', source: 'email' })

    const file = await call(
      appRouter.customerPrivacy.export,
      { customerId, format: 'json', dataRequestId: request.id },
      { context: boss.ctx },
    )
    expect(JSON.parse(file.body).profile.email).toBe('asha@example.com')

    const result = await call(
      appRouter.customerPrivacy.anonymise,
      { customerId, dataRequestId: request.id },
      { context: boss.ctx },
    )
    expect(result.customerId).toBe(customerId)

    const detail = await call(
      appRouter.customerPrivacy.request,
      { id: request.id },
      { context: boss.ctx },
    )
    expect(detail.request.status).toBe('completed')
    expect(detail.audit.map((e) => e.action)).toEqual([
      'request.status',
      'customer.anonymised',
      'export.downloaded',
      'request.created',
    ])
    expect(new Set(detail.audit.map((e) => e.actorLabel))).toEqual(new Set(['owner@example.com']))

    await expect(
      call(appRouter.customerPrivacy.anonymise, { customerId }, { context: boss.ctx }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('lets staff read the queue but not erase anyone', async () => {
    const boss = await merchant('owner@example.com', 'waimers')
    const helper = await staffMember(boss)
    const [cu] = await owner
      .insert(customer)
      .values({ storeId: boss.storeId, email: 'asha@example.com' })
      .returning()
    expect(
      await call(appRouter.customerPrivacy.requests, { status: 'open' }, { context: helper }),
    ).toEqual([])
    await expect(
      call(
        appRouter.customerPrivacy.anonymise,
        { customerId: cu?.id as string },
        { context: helper },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('records staff consent changes, including the customer page switch', async () => {
    const boss = await merchant('owner@example.com', 'waimers')
    const [cu] = await owner
      .insert(customer)
      .values({ storeId: boss.storeId, email: 'asha@example.com' })
      .returning()
    const customerId = cu?.id as string
    await call(
      appRouter.customerPrivacy.setConsent,
      { customerId, channel: 'whatsapp', granted: true },
      { context: boss.ctx },
    )
    await call(
      appRouter.customers.update,
      { id: customerId, acceptsMarketing: true },
      { context: boss.ctx },
    )
    const consent = await call(
      appRouter.customerPrivacy.consent,
      { customerId },
      { context: boss.ctx },
    )
    expect(consent.channels).toEqual({ email: true, whatsapp: true, sms: false })
    expect(consent.history.map((h) => [h.channel, h.source, h.actorType])).toEqual([
      ['email', 'admin', 'staff'],
      ['whatsapp', 'admin', 'staff'],
    ])
  })

  it('keeps other preferences when Online Store preferences and privacy settings are saved', async () => {
    const boss = await merchant('owner@example.com', 'waimers')
    await call(
      appRouter.customerPrivacy.saveSettings,
      { bannerMessage: 'We use cookies to run the store.', requestDueDays: 21 },
      { context: boss.ctx },
    )
    const prefs = await call(appRouter.store.getPreferences, {}, { context: boss.ctx })
    await call(appRouter.store.updatePreferences, prefs, { context: boss.ctx })
    const overview = await call(appRouter.customerPrivacy.overview, {}, { context: boss.ctx })
    expect(overview.settings).toMatchObject({
      bannerMessage: 'We use cookies to run the store.',
      requestDueDays: 21,
    })
    expect(overview.requests).toEqual({ open: 0, overdue: 0 })
  })
})

describe('customer accounts API', () => {
  it('offers only methods the store can send, and refuses the rest', async () => {
    const boss = await merchant('owner@example.com', 'waimers')
    const before = await call(appRouter.customerAccounts.get, {}, { context: boss.ctx })
    expect(before.settings).toMatchObject({ checkout: 'guest', loginMethods: ['email'] })
    expect(before.available).not.toContain('whatsapp')
    await expect(
      call(
        appRouter.customerAccounts.save,
        { checkout: 'guest', loginMethods: ['whatsapp'] },
        { context: boss.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    // The development SMS log channel makes SMS codes available outside production.
    await call(
      appRouter.store.updateNotifications,
      { enabled: ['log', 'log-sms'], providers: {}, recoverAbandoned: false, off: [] },
      { context: boss.ctx },
    )
    const after = await call(appRouter.customerAccounts.get, {}, { context: boss.ctx })
    expect(after.available).toEqual(['email', 'sms'])
    const saved = await call(
      appRouter.customerAccounts.save,
      { checkout: 'account_required', loginMethods: ['sms', 'email'] },
      { context: boss.ctx },
    )
    expect(saved).toMatchObject({ checkout: 'account_required', loginMethods: ['email', 'sms'] })
  })

  it('keeps a merchant’s own sign-in app encrypted and refuses a provider with no app', async () => {
    const boss = await merchant('owner@example.com', 'waimers')
    await call(
      appRouter.store.updateNotifications,
      { enabled: ['log'], providers: {}, recoverAbandoned: false, off: [] },
      { context: boss.ctx },
    )
    const before = await call(appRouter.customerAccounts.get, {}, { context: boss.ctx })
    expect(before.callbacks.google).toMatch(/\/oauth\/google\/callback$/)
    expect(before.readiness.google.own).toBe(false)
    const withGoogle = {
      ...before.settings,
      providers: {
        ...before.settings.providers,
        google: { enabled: true, credentials: 'own' as const },
      },
    }
    await expect(
      call(appRouter.customerAccounts.save, withGoogle, { context: boss.ctx }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      call(
        appRouter.customerAccounts.saveApp,
        { provider: 'google', fields: { clientId: 'id-only' } },
        { context: boss.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await call(
      appRouter.customerAccounts.saveApp,
      { provider: 'google', fields: { clientId: 'client-1', clientSecret: 'GOCSPX-verysecret' } },
      { context: boss.ctx },
    )
    const after = await call(appRouter.customerAccounts.get, {}, { context: boss.ctx })
    expect(after.readiness.google.own).toBe(true)
    expect(after.ownApps.google).toEqual({ clientId: 'client-1', clientSecret: '••••cret' })
    const saved = await call(appRouter.customerAccounts.save, withGoogle, { context: boss.ctx })
    expect(saved.providers.google).toEqual({ enabled: true, credentials: 'own' })
  })
})
