/**
 * Store settings › customer segments: Shopify's segment queries (`customer_tags CONTAINS
 * 'restock-x' AND number_of_orders >= 2`) as our segment conditions. Pure. A query with a
 * filter we have no condition for, or that mixes AND with OR, is left for the merchant with
 * the query shown, never imported half-way (a segment that quietly matches more people would
 * send a campaign to the wrong customers). Audit #87: Waimers' 14 segments stayed on Shopify.
 */
import type { SegmentCondition, SegmentRules } from '@commerce/core'
import type { SettingsItem } from './settings-client'
import { type LocalSettings, type PartPlan, same } from './settings-plan'

/** A Shopify segment as the Admin API gives it. */
export type NSegment = { sourceId: string; name: string; query: string }

/** One Shopify filter (`number_of_orders >= 2`) as our condition; null when ours has none. */
function conditionOf(clause: string): SegmentCondition | null {
  const c = clause.trim().replace(/^\((.*)\)$/, '$1').trim()
  const text = c.match(/^customer_tags\s+(NOT\s+)?CONTAINS\s+'([^']*)'$/i)
  if (text) {
    return { field: 'tag', op: text[1] ? 'neq' : 'contains', value: text[2] ?? '' }
  }
  const sub = c.match(/^email_subscription_status\s*(=|!=)\s*'([A-Z_]+)'$/i)
  if (sub) {
    const subscribed = (sub[2] ?? '').toUpperCase() === 'SUBSCRIBED'
    const yes = sub[1] === '=' ? subscribed : !subscribed
    return { field: 'marketing', op: 'eq', value: yes ? 'true' : 'false' }
  }
  const num = c.match(/^(number_of_orders|amount_spent)\s*(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)$/i)
  if (num) {
    const orders = (num[1] ?? '').toLowerCase() === 'number_of_orders'
    const op = num[2] ?? '='
    const n = Number(num[3])
    if (orders) {
      if (op === '=') return { field: 'orders', op: 'eq', value: String(n) }
      if (op === '>=' || op === '>')
        return { field: 'orders', op: 'gte', value: String(op === '>' ? n + 1 : n) }
      return { field: 'orders', op: 'lte', value: String(op === '<' ? n - 1 : n) }
    }
    // Spend is paise here, rupees there; "more than" and "at least" differ by a paisa.
    const paise = Math.round(n * 100)
    if (op === '>=' || op === '>')
      return { field: 'spend', op: 'gte', value: String(op === '>' ? paise + 1 : paise) }
    if (op === '<=' || op === '<')
      return { field: 'spend', op: 'lte', value: String(op === '<' ? paise - 1 : paise) }
    return null
  }
  // `last_order_date > -30d`: ordered in the last 30 days; `< -90d`: not for 90 days.
  const last = c.match(/^last_order_date\s*(>=|<=|>|<)\s*-(\d+)d$/i)
  if (last) {
    const days = String(Number(last[2]))
    return last[1]?.startsWith('>')
      ? { field: 'last_order_days', op: 'lte', value: days }
      : { field: 'last_order_days', op: 'gte', value: days }
  }
  return null
}

/** The whole query as our rules, or null when any part of it has no match here. */
export function segmentRules(query: string): SegmentRules | null {
  const q = query.trim()
  if (!q) return null
  const hasAnd = /\sAND\s/i.test(q)
  const hasOr = /\sOR\s/i.test(q)
  if (hasAnd && hasOr) return null
  const clauses = q.split(hasOr ? /\s+OR\s+/i : /\s+AND\s+/i)
  const conditions: SegmentCondition[] = []
  for (const clause of clauses) {
    const condition = conditionOf(clause)
    if (!condition) return null
    conditions.push(condition)
  }
  return { match: hasOr ? 'any' : 'all', conditions }
}

export function planSegments(source: readonly NSegment[], local: LocalSettings): PartPlan {
  const items: SettingsItem[] = []
  const ops: PartPlan['ops'] = []
  for (const s of source) {
    const name = s.name.trim().slice(0, 80)
    if (!name) continue
    if (local.segments.some((x) => same(x, name))) {
      // A segment with this name is the merchant's own now; it is never overwritten.
      items.push({ action: 'same', subject: 'segment', name })
      continue
    }
    const rules = segmentRules(s.query)
    if (!rules) {
      items.push({
        action: 'manual',
        subject: 'segment',
        name,
        reason: 'segment_rule',
        detail: s.query.slice(0, 300),
      })
      continue
    }
    items.push({ action: 'create', subject: 'segment', name, to: s.query.slice(0, 300) })
    ops.push({ kind: 'segment', name, rules })
  }
  return { items, ops }
}
