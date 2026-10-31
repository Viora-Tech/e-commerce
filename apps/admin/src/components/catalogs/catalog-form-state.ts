import type { CatalogView } from '@commerce/core'
import { minorDigits } from '@commerce/money'
import type { PickItem } from '@/components/pickers/resource-pick-types'

/** One fixed price as the form edits it: the amount as typed, in the market's major units. */
type CatalogScope = CatalogView['scope']
type CatalogStatus = CatalogView['status']

export type FixedPriceDraft = { variantId: string; amount: string; item: PickItem }

export type CatalogFormState = {
  name: string
  status: CatalogStatus
  scope: CatalogScope
  /** Whole-number percent typed, and which way. */
  percent: string
  direction: 'up' | 'down'
  productIds: string[]
  collectionIds: string[]
  marketIds: string[]
  prices: FixedPriceDraft[]
}

/** How a catalog's adjustment reads: +10%, −5%. */
export function percentLabel(bp: number): string {
  const value = Math.abs(bp) / 100
  return `${bp < 0 ? '−' : '+'}${Number.isInteger(value) ? value : value.toFixed(1)}%`
}

export function emptyCatalog(): CatalogFormState {
  return {
    name: '',
    status: 'active',
    scope: 'all',
    percent: '0',
    direction: 'up',
    productIds: [],
    collectionIds: [],
    marketIds: [],
    prices: [],
  }
}

export function fromCatalog(c: CatalogView): CatalogFormState {
  return {
    name: c.name,
    status: c.status,
    scope: c.scope,
    percent: String(Math.abs(c.priceAdjustmentBp) / 100),
    direction: c.priceAdjustmentBp < 0 ? 'down' : 'up',
    productIds: c.productIds,
    collectionIds: c.collectionIds,
    marketIds: c.markets.map((m) => m.id),
    prices: c.prices.map((p) => ({
      variantId: p.variantId,
      amount: (p.amountMinor / 10 ** minorDigits(p.currency)).toFixed(minorDigits(p.currency)),
      item: {
        id: p.variantId,
        title:
          p.variantTitle && p.variantTitle !== 'Default'
            ? `${p.title} · ${p.variantTitle}`
            : p.title,
      },
    })),
  }
}

/** Basis points from the typed percent; null when it is not a number. */
export function adjustmentBp(form: CatalogFormState): number | null {
  const n = Number(form.percent.trim() || '0')
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) * (form.direction === 'down' ? -1 : 1)
}

/** A typed price in minor units; null when it is not a number above zero. */
export function amountMinor(amount: string, currency: string): number | null {
  const n = Number(amount.trim())
  if (!amount.trim() || !Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 10 ** minorDigits(currency))
}
