/** SOURCE OF TRUTH: Growth automations CRUD and stats — WHAT: create from a template, read, update, switch, delete and list automations with their sent/converted stats / WHY: split out of automations.ts (enrolment and running stay there) */
import {
  type MarketingAutomationStatus,
  marketingAutomation,
  marketingAutomationRun,
  marketingMessage,
  type StoreTx,
} from '@commerce/db'
import { desc, eq, inArray, sql } from 'drizzle-orm'
import { automationTemplate } from './automation-steps'
// ---------------------------------------------------------------------------
import type { AutomationInput, AutomationRow } from './automations'

// CRUD

export async function createAutomationFromTemplate(
  tx: StoreTx,
  storeId: string,
  templateId: string,
): Promise<AutomationRow | null> {
  const t = automationTemplate(templateId)
  if (!t) return null
  const [row] = await tx
    .insert(marketingAutomation)
    .values({
      storeId,
      template: t.id,
      trigger: t.trigger,
      name: t.name,
      status: 'paused',
      steps: t.steps,
      settings: t.settings,
    })
    .returning()
  return row ?? null
}

export async function getAutomation(tx: StoreTx, id: string): Promise<AutomationRow | null> {
  const [row] = await tx.select().from(marketingAutomation).where(eq(marketingAutomation.id, id))
  return row ?? null
}

export async function updateAutomation(tx: StoreTx, id: string, input: AutomationInput) {
  const [row] = await tx
    .update(marketingAutomation)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(marketingAutomation.id, id))
    .returning()
  return row ?? null
}

/** Pausing holds every run where it is; resuming picks up at the next tick. */
export async function setAutomationStatus(
  tx: StoreTx,
  id: string,
  status: MarketingAutomationStatus,
) {
  const [row] = await tx
    .update(marketingAutomation)
    .set({ status, updatedAt: new Date() })
    .where(eq(marketingAutomation.id, id))
    .returning()
  return row ?? null
}

export async function deleteAutomation(tx: StoreTx, id: string) {
  await tx.delete(marketingAutomation).where(eq(marketingAutomation.id, id))
}

export type AutomationStats = {
  runs: number
  active: number
  converted: number
  sent: number
  opened: number
  clicked: number
  orders: number
  revenuePaise: number
}

const EMPTY: AutomationStats = {
  runs: 0,
  active: 0,
  converted: 0,
  sent: 0,
  opened: 0,
  clicked: 0,
  orders: 0,
  revenuePaise: 0,
}

/**
 * Runs, messages and the orders that ended a run (the shopper converted
 * while in the sequence), per automation.
 */
export async function automationStats(
  tx: StoreTx,
  ids: string[],
): Promise<Map<string, AutomationStats>> {
  const out = new Map<string, AutomationStats>(ids.map((id) => [id, { ...EMPTY }]))
  if (ids.length === 0) return out
  const runs = await tx
    .select({
      id: marketingAutomationRun.automationId,
      runs: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${marketingAutomationRun.status} = 'active')::int`,
      converted: sql<number>`count(*) filter (where ${marketingAutomationRun.status} = 'converted')::int`,
      revenue: sql<number>`coalesce(sum(o.total_paise) filter (where ${marketingAutomationRun.status} = 'converted' and not o.is_test), 0)::int`,
    })
    .from(marketingAutomationRun)
    .leftJoin(sql`"order" o`, sql`o.id = ${marketingAutomationRun.convertedOrderId}`)
    .where(inArray(marketingAutomationRun.automationId, ids))
    .groupBy(marketingAutomationRun.automationId)
  const messages = await tx
    .select({
      id: marketingMessage.automationId,
      sent: sql<number>`count(*) filter (where ${marketingMessage.status} = 'sent')::int`,
      opened: sql<number>`count(${marketingMessage.openedAt})::int`,
      clicked: sql<number>`count(${marketingMessage.clickedAt})::int`,
    })
    .from(marketingMessage)
    .where(inArray(marketingMessage.automationId, ids))
    .groupBy(marketingMessage.automationId)
  for (const r of runs) {
    const s = out.get(r.id)
    if (s)
      Object.assign(s, {
        runs: r.runs,
        active: r.active,
        converted: r.converted,
        orders: r.converted,
        revenuePaise: r.revenue,
      })
  }
  for (const m of messages) {
    const s = m.id ? out.get(m.id) : undefined
    if (s) Object.assign(s, { sent: m.sent, opened: m.opened, clicked: m.clicked })
  }
  return out
}

export type AutomationListItem = AutomationRow & { stats: AutomationStats }

export async function listAutomations(tx: StoreTx): Promise<AutomationListItem[]> {
  const rows = await tx
    .select()
    .from(marketingAutomation)
    .orderBy(desc(marketingAutomation.createdAt))
  const stats = await automationStats(
    tx,
    rows.map((r) => r.id),
  )
  return rows.map((r) => ({ ...r, stats: stats.get(r.id) ?? { ...EMPTY } }))
}
