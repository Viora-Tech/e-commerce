import {
  automationRun,
  automationRunRecord,
  automationVersion,
  automationWorkflow,
  cart,
  cartLine,
  createDb,
  customer,
  marketingMessage,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { MarketingSend, NotificationChannel } from '@commerce/notifications'
import { NotificationRegistry } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkflowDefinitionSchema } from '../automations/definition'
import { automationsEngineMode, cutoverStoreToEngine, verifyCutover } from './automation-cutover'
import {
  automationStats,
  createAutomationFromTemplate,
  enrolDue,
  processDueRuns,
  setAutomationStatus,
} from './automations'
import {
  createGrowthAutomation,
  getGrowthAutomation,
  listGrowthAutomations,
  setGrowthAutomationStatus,
  updateGrowthAutomation,
} from './growth-automations'
import type { MarketingDeps } from './send'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const MIN = 60_000
const HOUR = 60 * MIN

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

function recorder() {
  const sent: MarketingSend[] = []
  const make = (id: string, requires: 'email' | 'phone'): NotificationChannel => ({
    id,
    label: id,
    requires,
    send: async () => ({ ok: true, providerRef: 'x' }),
    sendMarketing: async (m) => {
      sent.push(m)
      return { ok: true, providerRef: `ref-${sent.length}` }
    },
  })
  const deps: MarketingDeps = {
    registry: new NotificationRegistry(),
    settingsSecret: 'test-secret',
    storefrontUrl: 'https://shop.test',
    channels: [make('fake-email', 'email'), make('fake-wa', 'phone')],
  }
  return { sent, deps }
}

/** A store with an abandoned-checkout run parked on its WhatsApp step and a paused win-back. */
async function legacyStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: 'Waimers' }).returning()
  const storeId = s?.id as string
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: `pad-${slug}`, title: 'Glasspad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'Black', pricePaise: 399900 })
    .returning()
  const [cu] = await owner
    .insert(customer)
    .values({ storeId, email: 'asha@x.in', acceptsMarketing: true, acceptsWhatsapp: true })
    .returning()
  const at = new Date(Date.now() - 61 * MIN)
  const [c] = await owner
    .insert(cart)
    .values({
      storeId,
      email: 'asha@x.in',
      customerId: cu?.id as string,
      customerName: 'Asha Menon',
      updatedAt: at,
      createdAt: at,
    })
    .returning()
  await owner.insert(cartLine).values({
    storeId,
    cartId: c?.id as string,
    variantId: v?.id as string,
    quantity: 1,
    unitPricePaise: 399900,
  })
  const ids = await withStore(app, storeId, async (tx) => {
    const a = await createAutomationFromTemplate(tx, storeId, 'abandoned_checkout')
    const b = await createAutomationFromTemplate(tx, storeId, 'win_back')
    await setAutomationStatus(tx, a?.id as string, 'active')
    return { checkout: a?.id as string, winBack: b?.id as string }
  })
  const { sent, deps } = recorder()
  const now = new Date()
  await withStore(app, storeId, async (tx) => {
    await enrolDue(tx, storeId, deps.settingsSecret, now)
    await processDueRuns(tx, storeId, deps, now)
  })
  expect(sent).toHaveLength(1)
  return { storeId, cartId: c?.id as string, ids, deps, sent, now }
}

describe('Growth cutover onto the engine', () => {
  it('copies automations and runs with their ids, links messages and flips the flag', async () => {
    const { storeId, cartId, ids } = await legacyStore('cut')
    const before = await withStore(app, storeId, (tx) => automationStats(tx, [ids.checkout]))

    const report = await withStore(app, storeId, (tx) => cutoverStoreToEngine(tx, storeId))
    expect(report).toMatchObject({
      alreadyEngine: false,
      workflows: 2,
      runs: 1,
      openRuns: 1,
      messagesLinked: 1,
      skippedAutomations: [],
    })
    expect(await withStore(app, storeId, (tx) => automationsEngineMode(tx, storeId))).toBe('engine')

    const workflows = await owner
      .select()
      .from(automationWorkflow)
      .where(eq(automationWorkflow.storeId, storeId))
    expect(workflows.map((w) => w.id).sort()).toEqual([ids.checkout, ids.winBack].sort())
    const checkout = workflows.find((w) => w.id === ids.checkout)
    expect(checkout).toMatchObject({
      origin: 'growth',
      status: 'on',
      triggerType: 'checkout.abandoned',
      templateId: 'abandoned_checkout',
    })
    expect(workflows.find((w) => w.id === ids.winBack)?.status).toBe('off')
    const [version] = await owner
      .select()
      .from(automationVersion)
      .where(eq(automationVersion.id, checkout?.publishedVersionId as string))
    expect(WorkflowDefinitionSchema.safeParse(version?.definition).success).toBe(true)
    expect(version?.number).toBe(1)

    const [run] = await owner.select().from(automationRun).where(eq(automationRun.storeId, storeId))
    expect(run).toMatchObject({
      workflowId: ids.checkout,
      status: 'waiting',
      cursor: 'whatsapp-1',
      triggerKey: `cart:${cartId}`,
      triggerType: 'checkout.abandoned',
      subjectType: 'cart',
      subjectId: cartId,
      metered: false,
      email: 'asha@x.in',
    })
    const [record] = await owner
      .select()
      .from(automationRunRecord)
      .where(eq(automationRunRecord.runId, run?.id as string))
    expect(record).toMatchObject({ recordType: 'cart', recordId: cartId, role: 'subject' })
    const [message] = await owner
      .select()
      .from(marketingMessage)
      .where(eq(marketingMessage.storeId, storeId))
    expect(message).toMatchObject({ automationRunId: run?.id, automationNodeId: 'email-1' })

    const checks = await withStore(app, storeId, (tx) => verifyCutover(tx, storeId))
    expect(checks.every((c) => c.ok)).toBe(true)

    // Growth reads the engine now, with the same stats.
    const list = await withStore(app, storeId, (tx) => listGrowthAutomations(tx, storeId))
    const item = list.find((a) => a.id === ids.checkout)
    expect(item).toMatchObject({
      engine: true,
      editable: true,
      trigger: 'checkout_abandoned',
      status: 'active',
      settings: { afterMinutes: 60 },
    })
    expect(item?.steps.map((s) => (s as { id: string }).id)).toEqual([
      'email-1',
      'wait-1',
      'whatsapp-1',
      'wait-2',
      'email-2',
    ])
    expect(item?.stats).toEqual(before.get(ids.checkout))
    const detail = await withStore(app, storeId, (tx) =>
      getGrowthAutomation(tx, storeId, ids.checkout),
    )
    expect(detail?.runs[0]).toMatchObject({ status: 'active', stepIndex: 2 })
  })

  it('is idempotent and leaves the legacy runner idle afterwards', async () => {
    const { storeId, ids, deps, sent, now } = await legacyStore('idem')
    await withStore(app, storeId, (tx) => cutoverStoreToEngine(tx, storeId))
    const again = await withStore(app, storeId, (tx) => cutoverStoreToEngine(tx, storeId))
    expect(again).toMatchObject({ alreadyEngine: true, workflows: 0, runs: 0 })
    expect(
      await owner.select().from(automationWorkflow).where(eq(automationWorkflow.storeId, storeId)),
    ).toHaveLength(2)

    // The old tick would send the WhatsApp nudge now; on an engine store it does nothing.
    const later = new Date(now.getTime() + 6 * HOUR)
    const r = await withStore(app, storeId, async (tx) => {
      const enrolled = await enrolDue(tx, storeId, deps.settingsSecret, later)
      return { enrolled, ...(await processDueRuns(tx, storeId, deps, later)) }
    })
    expect(r).toEqual({ enrolled: 0, processed: 0, sent: 0 })
    expect(sent).toHaveLength(1)
    expect(ids.checkout).toBeTruthy()
  })

  it('rolls back completely when the transaction does (dry run)', async () => {
    const { storeId } = await legacyStore('dry')
    const dry = new Error('dry run')
    await expect(
      withStore(app, storeId, async (tx) => {
        await cutoverStoreToEngine(tx, storeId)
        throw dry
      }),
    ).rejects.toBe(dry)
    expect(await withStore(app, storeId, (tx) => automationsEngineMode(tx, storeId))).toBe('legacy')
    expect(
      await owner.select().from(automationWorkflow).where(eq(automationWorkflow.storeId, storeId)),
    ).toHaveLength(0)
  })

  it('edits, pauses and creates Growth automations on the engine as new versions', async () => {
    const { storeId, ids } = await legacyStore('edit')
    await withStore(app, storeId, (tx) => cutoverStoreToEngine(tx, storeId))
    await withStore(app, storeId, async (tx) => {
      const updated = await updateGrowthAutomation(tx, storeId, ids.checkout, {
        name: 'Checkout nudge',
        steps: [{ id: 'email-1', type: 'email', subject: 'Hi', previewText: '', blocks: [] }],
        settings: { afterMinutes: 90 },
      })
      expect(updated).toMatchObject({ name: 'Checkout nudge', settings: { afterMinutes: 90 } })
      expect(updated?.steps).toHaveLength(1)
      const paused = await setGrowthAutomationStatus(tx, storeId, ids.checkout, 'paused')
      expect(paused?.status).toBe('paused')
      const created = await createGrowthAutomation(tx, storeId, 'cod_confirmation')
      expect(created).toMatchObject({ engine: true, trigger: 'cod_order_placed', status: 'paused' })
    })
    const versions = await owner
      .select()
      .from(automationVersion)
      .where(eq(automationVersion.workflowId, ids.checkout))
    expect(versions.map((v) => v.number).sort()).toEqual([1, 2])
    // The waiting run stays pinned to version 1.
    const [run] = await owner
      .select()
      .from(automationRun)
      .where(eq(automationRun.workflowId, ids.checkout))
    expect(versions.find((v) => v.id === run?.versionId)?.number).toBe(1)
  })
})
