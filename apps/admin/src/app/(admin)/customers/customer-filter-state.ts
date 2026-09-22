import type { SegmentRules } from '@commerce/core/segments'
import type { CustomerFilterState } from '@/components/customers/customer-filters'
import type { AppliedFilter } from '@/components/table/resource-table'
import { type CustomerSegment, customersContent } from '@/data/customers'
import { formatPaise } from '@/lib/money'

const copy = customersContent.filters.applied

function paise(rupees: string): number | undefined {
  const n = Number.parseFloat(rupees)
  return Number.isFinite(n) ? Math.round(n * 100) : undefined
}

function whole(value: string): number | undefined {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : undefined
}

export function hasCustomerFilters(f: CustomerFilterState): boolean {
  return Object.values(f).some((v) => v !== '')
}

/** Filter state to the shape `customers.list` and `customers.export` expect. */
export function customerFilterInput(f: CustomerFilterState) {
  return {
    stateCode: f.stateCode || undefined,
    minSpentPaise: f.minSpend ? paise(f.minSpend) : undefined,
    maxSpentPaise: f.maxSpend ? paise(f.maxSpend) : undefined,
    minOrders: f.minOrders ? whole(f.minOrders) : undefined,
    acceptsMarketing: f.marketing ? f.marketing === 'yes' : undefined,
    tag: f.tag || undefined,
  }
}

/** Chips shown above the table, each able to clear its own filter. */
export function appliedCustomerFilters(
  f: CustomerFilterState,
  clear: (key: keyof CustomerFilterState) => void,
): AppliedFilter[] {
  const chips: AppliedFilter[] = []
  if (f.stateCode) {
    chips.push({ key: 'state', label: copy.state(f.stateCode), onRemove: () => clear('stateCode') })
  }
  if (f.minSpend) {
    const amount = paise(f.minSpend)
    if (amount !== undefined) {
      chips.push({
        key: 'minSpend',
        label: copy.minSpend(formatPaise(amount)),
        onRemove: () => clear('minSpend'),
      })
    }
  }
  if (f.maxSpend) {
    const amount = paise(f.maxSpend)
    if (amount !== undefined) {
      chips.push({
        key: 'maxSpend',
        label: copy.maxSpend(formatPaise(amount)),
        onRemove: () => clear('maxSpend'),
      })
    }
  }
  if (f.minOrders) {
    const n = whole(f.minOrders)
    if (n !== undefined) {
      chips.push({ key: 'orders', label: copy.orders(n), onRemove: () => clear('minOrders') })
    }
  }
  if (f.marketing) {
    chips.push({
      key: 'marketing',
      label: copy.marketing(f.marketing === 'yes'),
      onRemove: () => clear('marketing'),
    })
  }
  if (f.tag) {
    chips.push({ key: 'tag', label: copy.tag(f.tag), onRemove: () => clear('tag') })
  }
  return chips
}

/** Turns the current filter into segment rules, so "Save as segment" opens a filled builder. */
export function segmentRulesFromFilters(
  f: CustomerFilterState,
  segment: CustomerSegment | null,
): SegmentRules {
  const rules: SegmentRules = { match: 'all', conditions: [] }
  if (f.stateCode) rules.conditions.push({ field: 'state', op: 'eq', value: f.stateCode })
  const min = f.minSpend ? paise(f.minSpend) : undefined
  if (min !== undefined) rules.conditions.push({ field: 'spend', op: 'gte', value: String(min) })
  const max = f.maxSpend ? paise(f.maxSpend) : undefined
  if (max !== undefined) rules.conditions.push({ field: 'spend', op: 'lte', value: String(max) })
  const orders = f.minOrders ? whole(f.minOrders) : undefined
  if (orders !== undefined) {
    rules.conditions.push({ field: 'orders', op: 'gte', value: String(orders) })
  } else if (segment === 'returning') {
    rules.conditions.push({ field: 'orders', op: 'gte', value: '2' })
  }
  if (f.marketing || segment === 'subscribed') {
    const wants = f.marketing ? f.marketing === 'yes' : true
    rules.conditions.push({ field: 'marketing', op: 'eq', value: String(wants) })
  }
  if (f.tag) rules.conditions.push({ field: 'tag', op: 'contains', value: f.tag })
  return rules
}
