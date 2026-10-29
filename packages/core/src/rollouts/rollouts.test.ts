/** SOURCE OF TRUTH: rollout tests — WHAT: saving (draft or scheduled, validation, conflicts), starting (every change in one go, launch ends at once, a deleted theme fails cleanly), ending (roll back or keep), pause and resume, edits made by hand during an event survive the roll back, the worker tick, store isolation, what the admin pages read (labels, holds, picker lists) / WHY: a sale weekend must start and end on time and leave the store exactly as the merchant expects */
import { createDb, discount, rollout, store, theme, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { defaultTheme } from '../theme/schema'
import { runRolloutsTick } from './job'
import { RolloutError, type RolloutSaveInput } from './schema'
import {
  createRollout,
  deleteRollout,
  endRollout,
  getRollout,
  pauseRollout,
  resumeRollout,
  rolloutConflicts,
  startRollout,
  updateRollout,
} from './service'
import { rolloutDiscountOptions, rolloutHolds, rolloutThemeOptions } from './targets'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

const HOUR = 3_600_000
const at = (h: number) => new Date(Date.UTC(2026, 10, 1, 0, 0, 0) + h * HOUR)

async function seed(slug = 'waimers') {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, preferences: { checkout: { branding: { accent: '#111111' } } } })
    .returning()
  const storeId = s?.id as string
  const [live, sale] = await owner
    .insert(theme)
    .values([
      { storeId, name: 'Everyday', role: 'main', settings: defaultTheme },
      { storeId, name: 'Diwali', role: 'unpublished', settings: defaultTheme },
    ])
    .returning()
  const [off10, off20] = await owner
    .insert(discount)
    .values([
      {
        storeId,
        title: 'DIWALI10',
        kind: 'code',
        code: 'DIWALI10',
        method: 'percent',
        value: 10,
        status: 'disabled',
      },
      {
        storeId,
        title: 'WELCOME',
        kind: 'code',
        code: 'WELCOME',
        method: 'percent',
        value: 5,
        status: 'active',
      },
    ])
    .returning()
  return {
    storeId,
    live: live?.id as string,
    sale: sale?.id as string,
    on: off10?.id as string,
    off: off20?.id as string,
  }
}

const liveTheme = (storeId: string) =>
  inStore(storeId, async (ctx) => {
    const [t] = await ctx.tx.select({ id: theme.id }).from(theme).where(eq(theme.role, 'main'))
    return t?.id
  })
const statusOf = (storeId: string, id: string) =>
  inStore(storeId, async (ctx) => {
    const [d] = await ctx.tx
      .select({ status: discount.status })
      .from(discount)
      .where(eq(discount.id, id))
    return d?.status
  })
const accent = (storeId: string) =>
  inStore(storeId, async (ctx) => {
    const [s] = await ctx.tx
      .select({ p: store.preferences })
      .from(store)
      .where(eq(store.id, storeId))
    return (s?.p as { checkout?: { branding?: { accent?: string } } })?.checkout?.branding?.accent
  })

const diwali = (s: Awaited<ReturnType<typeof seed>>): RolloutSaveInput => ({
  name: 'Diwali sale',
  kind: 'event',
  startsAt: at(0),
  endsAt: at(72),
  changes: [
    { kind: 'theme', themeId: s.sale },
    { kind: 'checkout_branding', branding: { accent: '#E8590C', button: '#E8590C' } },
    { kind: 'discount', discountId: s.on, status: 'active' },
    { kind: 'discount', discountId: s.off, status: 'disabled' },
  ],
})

describe('saving', () => {
  it('is a draft without a start, scheduled with a start and changes', async () => {
    const s = await seed()
    const draft = await inStore(s.storeId, (ctx) =>
      createRollout(ctx, { name: 'Later', changes: [{ kind: 'theme', themeId: s.sale }] }),
    )
    expect(draft.status).toBe('draft')
    const scheduled = await inStore(s.storeId, (ctx) => createRollout(ctx, diwali(s)))
    expect(scheduled.status).toBe('scheduled')
    expect(scheduled.changes).toHaveLength(4)
  })

  it('refuses an event without an end, and two theme changes in one rollout', async () => {
    const s = await seed()
    await expect(
      inStore(s.storeId, (ctx) => createRollout(ctx, { ...diwali(s), endsAt: null })),
    ).rejects.toThrow('An event needs an end date')
    await expect(
      inStore(s.storeId, (ctx) =>
        createRollout(ctx, {
          name: 'x',
          changes: [
            { kind: 'theme', themeId: s.sale },
            { kind: 'theme', themeId: s.live },
          ],
        }),
      ),
    ).rejects.toThrow('Only one theme change')
  })

  it('blocks a discount already in another rollout, and overlapping theme changes', async () => {
    const s = await seed()
    await inStore(s.storeId, (ctx) => createRollout(ctx, diwali(s)))
    const clash = { ...diwali(s), name: 'Overlap', startsAt: at(24), endsAt: at(48) }
    const found = await inStore(s.storeId, (ctx) => rolloutConflicts(ctx, clash))
    expect(found.map((c) => c.level)).toEqual(['block', 'block', 'block'])
    await expect(inStore(s.storeId, (ctx) => createRollout(ctx, clash))).rejects.toBeInstanceOf(
      RolloutError,
    )
    // After the event: no theme overlap, and a different discount is fine.
    const later = {
      name: 'After',
      kind: 'event' as const,
      startsAt: at(100),
      endsAt: at(120),
      changes: [{ kind: 'theme' as const, themeId: s.sale }],
    }
    expect(await inStore(s.storeId, (ctx) => rolloutConflicts(ctx, later))).toEqual([])
  })
})

describe('starting and ending', () => {
  it('applies every change at the start and rolls each back at the end', async () => {
    const s = await seed()
    const r = await inStore(s.storeId, (ctx) => createRollout(ctx, diwali(s)))
    const started = await inStore(s.storeId, (ctx) => startRollout(ctx, r.id, at(0)))
    expect(started.status).toBe('active')
    expect(await liveTheme(s.storeId)).toBe(s.sale)
    expect(await accent(s.storeId)).toBe('#E8590C')
    expect(await statusOf(s.storeId, s.on)).toBe('active')
    expect(await statusOf(s.storeId, s.off)).toBe('disabled')

    const ended = await inStore(s.storeId, (ctx) => endRollout(ctx, r.id, 'rollback', at(72)))
    expect(ended.status).toBe('ended')
    expect(await liveTheme(s.storeId)).toBe(s.live)
    expect(await accent(s.storeId)).toBe('#111111')
    expect(await statusOf(s.storeId, s.on)).toBe('disabled')
    expect(await statusOf(s.storeId, s.off)).toBe('active')
  })

  it('keeps everything when the event ends with apply', async () => {
    const s = await seed()
    const r = await inStore(s.storeId, (ctx) => createRollout(ctx, diwali(s)))
    await inStore(s.storeId, (ctx) => startRollout(ctx, r.id, at(0)))
    await inStore(s.storeId, (ctx) => endRollout(ctx, r.id, 'apply', at(72)))
    expect(await liveTheme(s.storeId)).toBe(s.sale)
    expect(await statusOf(s.storeId, s.on)).toBe('active')
  })

  it('ends a launch at once, its changes kept', async () => {
    const s = await seed()
    const r = await inStore(s.storeId, (ctx) =>
      createRollout(ctx, {
        name: 'New look',
        startsAt: at(0),
        changes: [{ kind: 'theme', themeId: s.sale }],
      }),
    )
    const done = await inStore(s.storeId, (ctx) => startRollout(ctx, r.id, at(0)))
    expect(done.status).toBe('ended')
    expect(await liveTheme(s.storeId)).toBe(s.sale)
  })

  it('leaves what the merchant changed by hand during the event', async () => {
    const s = await seed()
    const r = await inStore(s.storeId, (ctx) => createRollout(ctx, diwali(s)))
    await inStore(s.storeId, (ctx) => startRollout(ctx, r.id, at(0)))
    // Mid-sale the merchant switches DIWALI10 off again themselves.
    await owner.update(discount).set({ status: 'disabled' }).where(eq(discount.id, s.on))
    await inStore(s.storeId, (ctx) => endRollout(ctx, r.id, 'rollback', at(72)))
    expect(await statusOf(s.storeId, s.on)).toBe('disabled')
    // The rest still went back.
    expect(await liveTheme(s.storeId)).toBe(s.live)
  })

  it('pauses (rolled back) and resumes (applied again)', async () => {
    const s = await seed()
    const r = await inStore(s.storeId, (ctx) => createRollout(ctx, diwali(s)))
    await inStore(s.storeId, (ctx) => startRollout(ctx, r.id, at(0)))
    const paused = await inStore(s.storeId, (ctx) => pauseRollout(ctx, r.id))
    expect(paused.status).toBe('paused')
    expect(await liveTheme(s.storeId)).toBe(s.live)
    const resumed = await inStore(s.storeId, (ctx) => resumeRollout(ctx, r.id, at(10)))
    expect(resumed.status).toBe('active')
    expect(await liveTheme(s.storeId)).toBe(s.sale)
  })

  it('does not start when its theme was deleted, and changes nothing', async () => {
    const s = await seed()
    const r = await inStore(s.storeId, (ctx) => createRollout(ctx, diwali(s)))
    await owner.delete(theme).where(eq(theme.id, s.sale))
    await expect(inStore(s.storeId, (ctx) => startRollout(ctx, r.id, at(0)))).rejects.toThrow(
      'theme this rollout publishes was deleted',
    )
    expect(await accent(s.storeId)).toBe('#111111')
    expect(await statusOf(s.storeId, s.on)).toBe('disabled')
  })

  it('changes only the end of a running event, and cannot delete it', async () => {
    const s = await seed()
    const r = await inStore(s.storeId, (ctx) => createRollout(ctx, diwali(s)))
    await inStore(s.storeId, (ctx) => startRollout(ctx, r.id, at(0)))
    const moved = await inStore(s.storeId, (ctx) =>
      updateRollout(ctx, r.id, { ...diwali(s), endsAt: at(96), changes: [] }),
    )
    expect(moved.endsAt?.getTime()).toBe(at(96).getTime())
    expect(moved.changes).toHaveLength(4)
    await expect(inStore(s.storeId, (ctx) => deleteRollout(ctx, r.id))).rejects.toThrow(
      'End the rollout',
    )
  })
})

describe('the worker tick', () => {
  it('starts due rollouts, ends due events, once, and isolates stores', async () => {
    const a = await seed('a')
    const b = await seed('b')
    const r = await inStore(a.storeId, (ctx) => createRollout(ctx, diwali(a)))
    const notYet = await inStore(b.storeId, (ctx) =>
      createRollout(ctx, { ...diwali(b), startsAt: at(10), endsAt: at(20) }),
    )

    expect(await runRolloutsTick(app, at(1))).toMatchObject({ started: 1, ended: 0, failed: 0 })
    expect(await runRolloutsTick(app, at(2))).toMatchObject({ started: 0, ended: 0 })
    expect(await liveTheme(a.storeId)).toBe(a.sale)
    expect((await inStore(b.storeId, (ctx) => getRollout(ctx, notYet.id))).status).toBe('scheduled')

    expect(await runRolloutsTick(app, at(73))).toMatchObject({ ended: 1 })
    expect(await liveTheme(a.storeId)).toBe(a.live)
    expect((await inStore(a.storeId, (ctx) => getRollout(ctx, r.id))).status).toBe('ended')
  })

  it('turns a rollout that cannot start into a draft with the reason', async () => {
    const s = await seed()
    const r = await inStore(s.storeId, (ctx) => createRollout(ctx, diwali(s)))
    await owner.delete(theme).where(eq(theme.id, s.sale))
    expect(await runRolloutsTick(app, at(1))).toMatchObject({ failed: 1 })
    const [row] = await owner.select().from(rollout).where(eq(rollout.id, r.id))
    expect(row?.status).toBe('draft')
    expect(row?.error).toContain('deleted')
    expect(await runRolloutsTick(app, at(2))).toMatchObject({ stores: 0 })
  })
})

describe('what the admin shows', () => {
  it('labels each change and names the rollout holding each theme, discount and the checkout', async () => {
    const s = await seed()
    const r = await inStore(s.storeId, (ctx) => createRollout(ctx, diwali(s)))
    const labels = r.changes.map((c) => ('label' in c ? c.label : null))
    expect(labels).toEqual(['Diwali', null, 'DIWALI10', 'WELCOME'])

    const holds = await inStore(s.storeId, rolloutHolds)
    const hold = { id: r.id, name: 'Diwali sale', status: 'scheduled' }
    expect(holds.themes).toEqual({ [s.sale]: hold })
    expect(holds.discounts).toEqual({ [s.on]: hold, [s.off]: hold })
    expect(holds.checkout).toEqual(hold)

    // An ended rollout holds nothing.
    await inStore(s.storeId, (ctx) => startRollout(ctx, r.id, at(0)))
    await inStore(s.storeId, (ctx) => endRollout(ctx, r.id, 'rollback', at(1)))
    expect(await inStore(s.storeId, rolloutHolds)).toEqual({
      themes: {},
      discounts: {},
      checkout: null,
    })
  })

  it('lists themes live first and finds discounts by title or code, in this store only', async () => {
    const s = await seed()
    await seed('other')
    const themes = await inStore(s.storeId, rolloutThemeOptions)
    expect(themes.map((t) => [t.name, t.live])).toEqual([
      ['Everyday', true],
      ['Diwali', false],
    ])
    const all = await inStore(s.storeId, (ctx) =>
      rolloutDiscountOptions(ctx, { page: 1, perPage: 30 }),
    )
    expect(all.total).toBe(2)
    const found = await inStore(s.storeId, (ctx) =>
      rolloutDiscountOptions(ctx, { page: 1, perPage: 30, search: 'diwali' }),
    )
    expect(found).toMatchObject({ total: 1, items: [{ id: s.on, status: 'disabled' }] })
  })
})
