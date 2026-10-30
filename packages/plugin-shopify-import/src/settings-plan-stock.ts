/**
 * Store settings › purchase orders and transfers: Shopify's stock paperwork as ours (audit #75).
 * Pure. Each record comes over once (its id is remembered, so a second import changes nothing),
 * with its supplier found or made by name and every line matched to a variant the products
 * import brought over. A record with a line whose product is not here yet waits: import
 * products, then again. Stock itself is never moved: on-hand came over with the products, so
 * only what Shopify still has on the way (an ordered purchase order, a shipped transfer)
 * becomes incoming here.
 */
import { isCurrency, toMinor } from '@commerce/money'
import type { SettingsItem } from './settings-client'
import { type LocalSettings, type PartPlan, same } from './settings-plan'

/** A location as Shopify's snapshot names it; `sourceId` is null once the location is deleted. */
export type NStockLocation = { sourceId: string | null; name: string }

export type NStockLine = {
  productSourceId: string | null
  sku: string | null
  /** "Red / Small", or Shopify's "Default Title". */
  variantTitle: string | null
  title: string
  quantity: number
  /** Price per unit in the order's currency as Shopify writes it ("650.00"); null on transfers. */
  unitCost: string | null
}

/** A Shopify purchase order (Admin API 2026-10). */
export type NPurchaseOrder = {
  sourceId: string
  name: string
  /** DRAFT or ORDERED. */
  status: string
  archived: boolean
  currency: string
  supplierName: string | null
  destination: NStockLocation | null
  orderedAt: string | null
  /** Some of it was already received on Shopify (a linked transfer took units in). */
  received: boolean
  lines: NStockLine[]
}

/** A Shopify inventory transfer (Admin API 2026-10). */
export type NTransfer = {
  sourceId: string
  name: string
  /** DRAFT, READY_TO_SHIP, IN_PROGRESS, TRANSFERRED, CANCELED or OTHER. */
  status: string
  note: string | null
  createdAt: string | null
  origin: NStockLocation | null
  destination: NStockLocation | null
  lines: NStockLine[]
}

/** What the plan needs from this store beyond the locations. */
export type LocalStock = {
  suppliers: { id: string; name: string }[]
  /** Shopify product id → ours, from the products import. */
  products: ReadonlyMap<string, string>
  /** Live variants of those products. */
  variants: { id: string; productId: string; sku: string | null; title: string }[]
  /** Already imported (and still here): Shopify id → ours. */
  purchaseOrders: ReadonlyMap<string, string>
  transfers: ReadonlyMap<string, string>
}

/**
 * Where a record's location is: our id, or null when the Locations part of this same import
 * creates it (the write then finds it by `sourceId` through the location mapping).
 */
export type StockLocationRef = { id: string | null; sourceId: string | null }

export type StockLineWrite = { variantId: string; quantity: number; unitPriceMinor: number }

export type PurchaseOrderWrite = {
  sourceId: string
  name: string
  supplier: { id: string | null; name: string }
  location: StockLocationRef
  currency: 'INR'
  /** `closed`: archived after ordering; `cancelled`: archived as a draft. */
  status: 'draft' | 'ordered' | 'closed' | 'cancelled'
  orderedAt: string | null
  lines: StockLineWrite[]
}

export type TransferWrite = {
  sourceId: string
  from: StockLocationRef
  to: StockLocationRef
  status: 'draft' | 'in_transit' | 'received'
  note: string
  shippedAt: string | null
  lines: StockLineWrite[]
}

/** Shopify's supplier name when it gave none (the order still needs one). */
export const UNNAMED_SUPPLIER = 'Supplier from Shopify'

/** Orders in other currencies need an exchange rate, and Shopify gives none. */
const IMPORTABLE_CURRENCY = 'INR'

function locationRef(
  loc: NStockLocation | null,
  local: LocalSettings,
  pending: ReadonlySet<string>,
): StockLocationRef | null {
  if (!loc) return null
  const mapped = loc.sourceId ? local.mapped.locations.get(loc.sourceId) : undefined
  if (mapped && local.locations.some((l) => l.id === mapped)) {
    return { id: mapped, sourceId: loc.sourceId }
  }
  const named = local.locations.find((l) => same(l.name, loc.name))
  if (named) return { id: named.id, sourceId: loc.sourceId }
  if (loc.sourceId && pending.has(loc.sourceId)) return { id: null, sourceId: loc.sourceId }
  return null
}

/**
 * The variant here for a Shopify line: by SKU, then by title ("Red / Small"; Shopify's
 * "Default Title" is our "Default"), then the product's only variant.
 */
export function variantFor(line: NStockLine, stock: LocalStock): string | null {
  const productId = line.productSourceId ? stock.products.get(line.productSourceId) : undefined
  if (!productId) return null
  const options = stock.variants.filter((v) => v.productId === productId)
  const sku = line.sku?.trim()
  const bySku = sku ? options.find((v) => v.sku && same(v.sku, sku)) : undefined
  if (bySku) return bySku.id
  const title = line.variantTitle?.trim() ?? ''
  const wanted = !title || same(title, 'Default Title') ? 'Default' : title
  const byTitle = options.find((v) => same(v.title, wanted))
  if (byTitle) return byTitle.id
  return options.length === 1 ? (options[0]?.id ?? null) : null
}

/** The lines as writes, or how many have no variant here. Repeats of a variant add up. */
function linesOf(
  lines: readonly NStockLine[],
  stock: LocalStock,
  currency: string,
): { ok: true; lines: StockLineWrite[] } | { ok: false; missing: number } {
  const out = new Map<string, StockLineWrite>()
  let missing = 0
  for (const l of lines) {
    if (l.quantity <= 0) continue
    const variantId = variantFor(l, stock)
    if (!variantId) {
      missing++
      continue
    }
    const amount = Number(l.unitCost ?? 0)
    const unitPriceMinor =
      Number.isFinite(amount) && amount > 0 && isCurrency(currency) ? toMinor(amount, currency) : 0
    const was = out.get(variantId)
    if (was) was.quantity += l.quantity
    else out.set(variantId, { variantId, quantity: l.quantity, unitPriceMinor })
  }
  return missing ? { ok: false, missing } : { ok: true, lines: [...out.values()] }
}

const units = (lines: readonly StockLineWrite[]) => lines.reduce((n, l) => n + l.quantity, 0)

export function planPurchaseOrders(
  source: readonly NPurchaseOrder[],
  local: LocalSettings,
  /** Shopify location ids the Locations part of this import creates or matches. */
  pending: ReadonlySet<string>,
): PartPlan {
  const items: SettingsItem[] = []
  const ops: PartPlan['ops'] = []
  const stock = local.stock
  for (const po of source) {
    const name = po.name.trim().slice(0, 120) || po.sourceId
    if (stock.purchaseOrders.has(po.sourceId)) {
      items.push({ action: 'same', subject: 'purchase_order', name })
      continue
    }
    const currency = po.currency.toUpperCase()
    if (currency !== IMPORTABLE_CURRENCY) {
      items.push({
        action: 'manual',
        subject: 'purchase_order',
        name,
        reason: 'po_currency',
        detail: currency,
      })
      continue
    }
    const location = locationRef(po.destination, local, pending)
    if (!location) {
      items.push({
        action: 'manual',
        subject: 'purchase_order',
        name,
        reason: 'stock_location_missing',
        detail: po.destination?.name ?? '',
      })
      continue
    }
    const lines = linesOf(po.lines, stock, currency)
    if (!lines.ok || lines.lines.length === 0) {
      items.push({
        action: 'manual',
        subject: 'purchase_order',
        name,
        reason: 'stock_products_missing',
        detail: String(lines.ok ? po.lines.length : lines.missing),
      })
      continue
    }
    const supplierName = po.supplierName?.trim().slice(0, 120) || UNNAMED_SUPPLIER
    const supplier = stock.suppliers.find((s) => same(s.name, supplierName))
    const ordered = po.status === 'ORDERED'
    const status: PurchaseOrderWrite['status'] = po.archived
      ? ordered
        ? 'closed'
        : 'cancelled'
      : ordered
        ? 'ordered'
        : 'draft'
    items.push({
      action: 'create',
      subject: 'purchase_order',
      name,
      to: `${supplierName} · ${units(lines.lines)}`,
    })
    if (po.received && status === 'ordered') {
      items.push({ action: 'warn', subject: 'purchase_order', name, reason: 'po_receipts' })
    }
    ops.push({
      kind: 'purchase_order',
      write: {
        sourceId: po.sourceId,
        name,
        supplier: { id: supplier?.id ?? null, name: supplierName },
        location,
        currency: IMPORTABLE_CURRENCY,
        status,
        orderedAt: po.orderedAt,
        lines: lines.lines,
      },
    })
  }
  return { items, ops }
}

const TRANSFER_STATUS: Record<string, TransferWrite['status']> = {
  DRAFT: 'draft',
  READY_TO_SHIP: 'draft',
  IN_PROGRESS: 'in_transit',
  TRANSFERRED: 'received',
}

export function planTransfers(
  source: readonly NTransfer[],
  local: LocalSettings,
  pending: ReadonlySet<string>,
): PartPlan {
  const items: SettingsItem[] = []
  const ops: PartPlan['ops'] = []
  const stock = local.stock
  for (const t of source) {
    const name = t.name.trim().slice(0, 120) || t.sourceId
    if (stock.transfers.has(t.sourceId)) {
      items.push({ action: 'same', subject: 'transfer', name })
      continue
    }
    const status = TRANSFER_STATUS[t.status]
    if (!status) {
      items.push({
        action: 'manual',
        subject: 'transfer',
        name,
        reason: 'transfer_status',
        detail: t.status.toLowerCase(),
      })
      continue
    }
    // A purchase order's receipt has no origin; it is the purchase order here.
    if (!t.origin) {
      items.push({ action: 'manual', subject: 'transfer', name, reason: 'transfer_origin' })
      continue
    }
    const from = locationRef(t.origin, local, pending)
    const to = locationRef(t.destination, local, pending)
    const missing = !from ? t.origin : !to ? t.destination : null
    if (!from || !to) {
      items.push({
        action: 'manual',
        subject: 'transfer',
        name,
        reason: 'stock_location_missing',
        detail: missing?.name ?? '',
      })
      continue
    }
    const sameEnds = from.id ? from.id === to.id : from.sourceId === to.sourceId
    if (sameEnds) {
      items.push({ action: 'manual', subject: 'transfer', name, reason: 'transfer_origin' })
      continue
    }
    const lines = linesOf(t.lines, stock, IMPORTABLE_CURRENCY)
    if (!lines.ok || lines.lines.length === 0) {
      items.push({
        action: 'manual',
        subject: 'transfer',
        name,
        reason: 'stock_products_missing',
        detail: String(lines.ok ? t.lines.length : lines.missing),
      })
      continue
    }
    items.push({
      action: 'create',
      subject: 'transfer',
      name,
      to: `${t.origin.name} → ${t.destination?.name ?? ''} · ${units(lines.lines)}`,
    })
    const note = [`Shopify ${name}`, t.note?.trim()].filter(Boolean).join('\n').slice(0, 2000)
    ops.push({
      kind: 'transfer',
      write: {
        sourceId: t.sourceId,
        from,
        to,
        status,
        note,
        shippedAt: status === 'draft' ? null : t.createdAt,
        // Transfers carry no prices.
        lines: lines.lines.map((l) => ({ ...l, unitPriceMinor: 0 })),
      },
    })
  }
  return { items, ops }
}
