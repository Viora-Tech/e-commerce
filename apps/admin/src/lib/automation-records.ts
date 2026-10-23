/**
 * Store records the Automations editor picks: a collection or product for an action's config,
 * an order, customer or product to test a draft on. One search shape over the admin's list
 * procedures, so the picker dialog stays generic.
 */
import { api } from '@/lib/api-client'

export type RecordKind = 'order' | 'customer' | 'product' | 'collection'
export type RecordOption = { id: string; label: string; detail: string | null }

const RESULTS = 20

export async function searchRecords(kind: RecordKind, query: string): Promise<RecordOption[]> {
  const search = query.trim() || undefined
  if (kind === 'collection') {
    const rows = await api.collections.list()
    const q = (search ?? '').toLowerCase()
    return rows
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .slice(0, RESULTS)
      .map((c) => ({ id: c.id, label: c.title, detail: c.handle }))
  }
  if (kind === 'product') {
    const { items } = await api.products.list({ page: 1, perPage: RESULTS, search })
    return items.map((p) => ({ id: p.id, label: p.title, detail: p.handle }))
  }
  if (kind === 'customer') {
    const { items } = await api.customers.list({ page: 1, perPage: RESULTS, search })
    return items.map((c) => ({
      id: c.id,
      label: c.name || c.email || c.id,
      detail: c.name ? (c.email ?? null) : null,
    }))
  }
  const { items } = await api.orders.list({ page: 1, perPage: RESULTS, search })
  return items.map((o) => ({ id: o.id, label: `#${o.number}`, detail: o.customerName ?? null }))
}

/** Words for ids picked earlier (a collection already in a step's config). */
export async function recordLabel(kind: RecordKind, id: string): Promise<string | null> {
  if (kind === 'collection') {
    const rows = await api.collections.list()
    return rows.find((c) => c.id === id)?.title ?? null
  }
  if (kind === 'product') {
    const { items } = await api.products.list({ page: 1, perPage: 1, ids: [id] })
    return items[0]?.title ?? null
  }
  return null
}
