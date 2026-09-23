import type { StoreTx } from '@commerce/db'
import { inventoryLevel, location, product, store, variant } from '@commerce/db'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { type LineFact, lineFacts, variantLabel } from './sales'
import { byDesc, groupBy, type ReportBuilder, type ReportRow, ratio, sumOf } from './types'

const VARIANT_ROWS = 500
/** ABC cut-offs on cumulative gross sales. */
const A_SHARE = 0.8
const B_SHARE = 0.95

type LevelFact = {
  variantId: string
  productTitle: string
  variantTitle: string
  sku: string | null
  pricePaise: number
  costPaise: number | null
  trackInventory: boolean
  locationId: string | null
  locationName: string | null
  sellable: boolean
  onHand: number
  reserved: number
  incoming: number
}

/** Stock rows of live variants on products that are not archived. */
async function levelFacts(tx: StoreTx): Promise<LevelFact[]> {
  return tx
    .select({
      variantId: variant.id,
      productTitle: product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      pricePaise: variant.pricePaise,
      costPaise: variant.costPaise,
      trackInventory: variant.trackInventory,
      locationId: inventoryLevel.locationId,
      locationName: location.name,
      sellable: inventoryLevel.fulfilsOnline,
      onHand: inventoryLevel.onHand,
      reserved: inventoryLevel.reserved,
      incoming: inventoryLevel.incoming,
    })
    .from(inventoryLevel)
    .innerJoin(variant, eq(variant.id, inventoryLevel.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(location, eq(location.id, inventoryLevel.locationId))
    .where(and(isNull(variant.archivedAt), ne(product.status, 'archived')))
}

function soldByVariant(lines: LineFact[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const l of lines) out.set(l.variantId, (out.get(l.variantId) ?? 0) + l.quantity)
  return out
}

/** Days the available stock lasts at `perDay`; null when the variant did not sell. */
function cover(available: number, perDay: number): number | null {
  return perDay > 0 ? Math.max(0, available) / perDay : null
}

const coverOrder = (a: ReportRow, b: ReportRow) => {
  const x = a.values.daysOfCover as number | null
  const y = b.values.daysOfCover as number | null
  if (x === null) return y === null ? 0 : 1
  if (y === null) return -1
  return x - y
}

export const inventoryBuilders: Record<string, ReportBuilder> = {
  'inventory-on-hand': async (tx) => {
    const levels = await levelFacts(tx)
    const tally = (group: LevelFact[]) => ({
      variants: new Set(group.filter((l) => l.onHand > 0).map((l) => l.variantId)).size,
      onHand: sumOf(group, (l) => l.onHand),
      committed: sumOf(group, (l) => l.reserved),
      available: sumOf(group, (l) => l.onHand - l.reserved),
      incoming: sumOf(group, (l) => l.incoming),
      costValue: sumOf(group, (l) => Math.max(0, l.onHand) * (l.costPaise ?? 0)),
      retailValue: sumOf(group, (l) => Math.max(0, l.onHand) * l.pricePaise),
    })
    return {
      rows: [...groupBy(levels, (l) => l.locationId ?? '')]
        .map(([key, group]) => ({
          key,
          values: { location: group[0]?.locationName ?? null, ...tally(group) },
        }))
        .sort(byDesc('onHand')),
      totals: tally(levels),
    }
  },

  'sell-through': async (tx, span) => {
    const levels = (await levelFacts(tx)).filter((l) => l.trackInventory)
    const sold = soldByVariant(await lineFacts(tx, span))
    const rows = [...groupBy(levels, (l) => l.variantId)]
      .map(([key, group]) => {
        const first = group[0] as LevelFact
        const onHand = sumOf(group, (l) => Math.max(0, l.onHand))
        const units = sold.get(key) ?? 0
        return {
          key,
          values: {
            variant: variantLabel(first.productTitle, first.variantTitle),
            sku: first.sku,
            sold: units,
            onHand,
            sellThrough: ratio(units, units + onHand),
          },
        }
      })
      .filter((r) => Number(r.values.sold) > 0 || Number(r.values.onHand) > 0)
      .sort((a, b) => byDesc('sold')(a, b) || byDesc('sellThrough')(a, b))
    const units = sumOf(rows, (r) => Number(r.values.sold))
    const onHand = sumOf(rows, (r) => Number(r.values.onHand))
    return {
      rows: rows.slice(0, VARIANT_ROWS),
      totals: { sold: units, onHand, sellThrough: ratio(units, units + onHand) },
    }
  },

  'days-of-cover': async (tx, span) => {
    const levels = (await levelFacts(tx)).filter((l) => l.trackInventory && l.sellable)
    const sold = soldByVariant(await lineFacts(tx, span))
    const days = Math.max(1, span.days.length)
    const rows = levels
      .map((l) => {
        const available = l.onHand - l.reserved
        const perDay = (sold.get(l.variantId) ?? 0) / days
        return {
          key: l.variantId,
          values: {
            variant: variantLabel(l.productTitle, l.variantTitle),
            sku: l.sku,
            available,
            perDay,
            daysOfCover: cover(available, perDay),
          },
        }
      })
      .filter((r) => Number(r.values.perDay) > 0 || Number(r.values.available) > 0)
      .sort(coverOrder)
    const available = sumOf(levels, (l) => l.onHand - l.reserved)
    const perDay = sumOf([...sold.values()], (n) => n) / days
    return {
      rows: rows.slice(0, VARIANT_ROWS),
      totals: { available, perDay, daysOfCover: cover(available, perDay) },
    }
  },

  'abc-analysis': async (tx, span) => {
    const lines = await lineFacts(tx, span)
    const active = await tx
      .select({ id: product.id, title: product.title })
      .from(product)
      .where(eq(product.status, 'active'))
    const byProduct = groupBy(lines, (l) => l.productId)
    const total = sumOf(lines, (l) => l.grossPaise)
    const titles = new Map(active.map((p) => [p.id, p.title]))
    for (const l of lines) titles.set(l.productId, l.productTitle)
    const ranked = [...titles]
      .map(([id, title]) => {
        const group = byProduct.get(id) ?? []
        return {
          id,
          title,
          units: sumOf(group, (l) => l.quantity),
          grossSales: sumOf(group, (l) => l.grossPaise),
        }
      })
      .sort((a, b) => b.grossSales - a.grossSales || a.title.localeCompare(b.title))
    let running = 0
    const rows: ReportRow[] = ranked.map((p) => {
      const before = total > 0 ? running / total : 1
      running += p.grossSales
      const abcClass =
        p.grossSales <= 0 ? 'C' : before < A_SHARE ? 'A' : before < B_SHARE ? 'B' : 'C'
      return {
        key: p.id,
        values: {
          product: p.title,
          abcClass,
          units: p.units,
          grossSales: p.grossSales,
          share: ratio(p.grossSales, total),
          cumulativeShare: ratio(running, total),
        },
      }
    })
    const count = (c: string) => rows.filter((r) => r.values.abcClass === c).length
    return {
      rows,
      totals: {
        abcClass: `A ${count('A')} / B ${count('B')} / C ${count('C')}`,
        units: sumOf(ranked, (p) => p.units),
        grossSales: total,
        share: total > 0 ? 1 : null,
      },
    }
  },

  'low-stock': async (tx, span) => {
    const [settings] = await tx.select({ n: store.lowStockThreshold }).from(store).limit(1)
    const threshold = settings?.n ?? 5
    const levels = (await levelFacts(tx)).filter(
      (l) => l.trackInventory && l.sellable && l.onHand - l.reserved <= threshold,
    )
    const sold = soldByVariant(await lineFacts(tx, span))
    const days = Math.max(1, span.days.length)
    const rows = levels
      .map((l) => {
        const available = l.onHand - l.reserved
        const units = sold.get(l.variantId) ?? 0
        return {
          key: l.variantId,
          values: {
            variant: variantLabel(l.productTitle, l.variantTitle),
            sku: l.sku,
            available,
            committed: l.reserved,
            incoming: l.incoming,
            sold: units,
            daysOfCover: cover(available, units / days),
          },
        }
      })
      .sort(
        (a, b) => Number(a.values.available) - Number(b.values.available) || byDesc('sold')(a, b),
      )
    return {
      rows: rows.slice(0, VARIANT_ROWS),
      totals: {
        available: sumOf(levels, (l) => l.onHand - l.reserved),
        committed: sumOf(levels, (l) => l.reserved),
        incoming: sumOf(levels, (l) => l.incoming),
        sold: sumOf(rows, (r) => Number(r.values.sold)),
      },
    }
  },
}
