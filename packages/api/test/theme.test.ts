import { createMerchantAuth } from '@commerce/auth'
import { settingsSecret } from '@commerce/config'
import {
  applyThemePreset,
  defaultPreferences,
  defaultTheme,
  readThemePreviewToken,
  THEME_PRESET_IDS,
  verifyThemePreviewToken,
} from '@commerce/core'
import { createDb, role, store, storeMember, theme } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

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

const ctx = (headers: Headers): ApiContext => ({
  db: app,
  auth,
  headers,
  notifications: { add: async () => undefined },
})

async function merchantWithStore(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  if (!s) throw new Error('seed')
  return { headers, organizationId: org?.id as string, storeId: s.id }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('store theme', () => {
  it('reads the default for a store that never saved one, and round-trips a preset', async () => {
    const m = await merchantWithStore('theme@example.com', 'theme-a')
    const first = await call(appRouter.store.getTheme, undefined, { context: ctx(m.headers) })
    expect(first.theme).toEqual(defaultTheme)
    expect(
      verifyThemePreviewToken({
        secret: settingsSecret(),
        storeId: m.storeId,
        token: first.previewToken,
      }),
    ).toBe(true)

    const soft = applyThemePreset(defaultTheme, 'soft')
    const saved = await call(appRouter.store.updateTheme, soft, { context: ctx(m.headers) })
    expect(saved.preset).toBe('soft')
    const second = await call(appRouter.store.getTheme, undefined, { context: ctx(m.headers) })
    expect(second.theme).toEqual(soft)
    expect(THEME_PRESET_IDS).toContain(saved.preset)

    const [legacy] = await owner
      .select({ theme: store.theme })
      .from(store)
      .where(eq(store.id, m.storeId))
    expect(legacy?.theme).toBeNull()
    const rows = await owner.select().from(theme).where(eq(theme.storeId, m.storeId))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ role: 'main', preset: 'soft' })
  })

  it('rejects a scheme id that could escape the storefront style block', async () => {
    const m = await merchantWithStore('xss@example.com', 'theme-b')
    const evil = {
      ...defaultTheme,
      schemes: defaultTheme.schemes.map((s, i) =>
        i === 0 ? { ...s, id: 'x{}</style><script>alert(1)</script>' } : s,
      ),
    }
    await expect(
      call(appRouter.store.updateTheme, evil, { context: ctx(m.headers) }),
    ).rejects.toThrow()
  })

  it('needs online store write, which the staff role does not have', async () => {
    const boss = await merchantWithStore('boss-theme@example.com', 'theme-c')
    await call(appRouter.staff.me, {}, { context: ctx(boss.headers) })

    const helperHeaders = await signIn('helper-theme@example.com')
    const helperId = (await auth.api.getSession({ headers: helperHeaders }))?.user.id as string
    await auth.api.addMember({
      body: { userId: helperId, role: 'member', organizationId: boss.organizationId },
    })
    await auth.api.setActiveOrganization({
      headers: helperHeaders,
      body: { organizationId: boss.organizationId },
    })
    const [staff] = await owner
      .select()
      .from(role)
      .where(and(eq(role.storeId, boss.storeId), eq(role.slug, 'staff')))
    if (!staff) throw new Error('no staff role')
    await owner
      .insert(storeMember)
      .values({ storeId: boss.storeId, userId: helperId, roleId: staff.id })

    await expect(
      call(appRouter.store.updateTheme, defaultTheme, { context: ctx(helperHeaders) }),
    ).rejects.toThrow()
  })
})

describe('theme library', () => {
  it('lists the live theme, adds from a preset, publishes it, and guards deleting the live one', async () => {
    const m = await merchantWithStore('library@example.com', 'theme-lib')
    const c = { context: ctx(m.headers) }
    const [live] = await call(appRouter.themes.list, undefined, c)
    expect(live).toMatchObject({ role: 'main', name: 'Waimers' })

    const bold = await call(appRouter.themes.create, { preset: 'bold' }, c)
    expect(bold).toMatchObject({ role: 'unpublished', name: 'Bold' })
    expect(
      readThemePreviewToken({
        secret: settingsSecret(),
        storeId: m.storeId,
        token: bold.previewToken,
      }),
    ).toEqual({ themeId: bold.id })

    const edited = { ...bold.settings, roundedSections: !bold.settings.roundedSections }
    const saved = await call(appRouter.themes.update, { id: bold.id, settings: edited }, c)
    expect(saved.settings.roundedSections).toBe(edited.roundedSections)
    expect((await call(appRouter.store.getTheme, undefined, c)).theme.preset).toBe('waimers')

    await call(appRouter.themes.publish, { id: bold.id }, c)
    expect((await call(appRouter.store.getTheme, undefined, c)).theme.preset).toBe('bold')
    await expect(call(appRouter.themes.delete, { id: bold.id }, c)).rejects.toThrow(
      /Publish another theme/,
    )
    await call(appRouter.themes.delete, { id: live?.id as string }, c)
    expect(await call(appRouter.themes.list, undefined, c)).toHaveLength(1)
    await expect(call(appRouter.themes.get, { id: live?.id as string }, c)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('keeps another store out', async () => {
    const a = await merchantWithStore('lib-a@example.com', 'theme-lib-a')
    const b = await merchantWithStore('lib-b@example.com', 'theme-lib-b')
    const aTheme = await call(
      appRouter.themes.create,
      { preset: 'soft' },
      { context: ctx(a.headers) },
    )
    await expect(
      call(appRouter.themes.publish, { id: aTheme.id }, { context: ctx(b.headers) }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('theme templates', () => {
  it('saves drafts, commits them, creates alternates, and keeps another store out', async () => {
    const m = await merchantWithStore('tpl@example.com', 'theme-tpl')
    const c = { context: ctx(m.headers) }
    const [live] = await call(appRouter.themes.list, undefined, c)
    const themeId = live?.id as string
    const data = {
      root: { props: {} },
      content: [{ type: 'Faq', props: { id: 'faq-1', heading: 'Questions' } }],
    }
    await call(appRouter.themes.templates.saveDraft, { themeId, template: 'home', data }, c)
    const draft = await call(appRouter.themes.templates.get, { themeId, template: 'home' }, c)
    expect(draft).toMatchObject({ draft: true, data: { content: [{ type: 'Faq' }] } })
    expect(await call(appRouter.themes.templates.commit, { themeId }, c)).toEqual({ saved: 1 })

    const alt = await call(
      appRouter.themes.templates.create,
      { themeId, template: 'page', suffix: 'contact' },
      c,
    )
    expect(alt.data.content.map((s) => s.type)).toEqual(['MainPage'])
    const listed = await call(appRouter.themes.templates.list, { themeId }, c)
    expect(listed.map((t) => `${t.template}.${t.suffix}`)).toEqual(['home.', 'page.contact'])

    await expect(
      call(
        appRouter.themes.templates.saveDraft,
        {
          themeId,
          template: 'home',
          data: { root: {}, content: [{ type: 'X', props: {} as { id: string } }] },
        },
        c,
      ),
    ).rejects.toThrow()

    const other = await merchantWithStore('tpl-b@example.com', 'theme-tpl-b')
    const seen = await call(
      appRouter.themes.templates.list,
      { themeId },
      { context: ctx(other.headers) },
    )
    expect(seen).toEqual([])
  })
})

describe('store preferences', () => {
  it('defaults, saves, and validates tracking ids and the password', async () => {
    const m = await merchantWithStore('prefs@example.com', 'prefs-a')
    const c = { context: ctx(m.headers) }
    expect(await call(appRouter.store.getPreferences, undefined, c)).toEqual(defaultPreferences)

    const saved = await call(
      appRouter.store.updatePreferences,
      {
        ...defaultPreferences,
        seo: { ...defaultPreferences.seo, title: 'Waimers', description: 'Handmade goods' },
        tracking: { ga4: ' g-abc123xyz ', gtm: '', metaPixel: '' },
      },
      c,
    )
    expect(saved.tracking.ga4).toBe('G-ABC123XYZ')
    expect((await call(appRouter.store.getPreferences, undefined, c)).seo.title).toBe('Waimers')

    await expect(
      call(
        appRouter.store.updatePreferences,
        { ...defaultPreferences, tracking: { ga4: 'UA-1234', gtm: '', metaPixel: '' } },
        c,
      ),
    ).rejects.toThrow()
    await expect(
      call(
        appRouter.store.updatePreferences,
        { ...defaultPreferences, password: { enabled: true, password: 'ab', message: '' } },
        c,
      ),
    ).rejects.toThrow()
  })
})
