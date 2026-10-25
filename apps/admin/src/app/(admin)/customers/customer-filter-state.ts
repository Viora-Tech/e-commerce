import type { SegmentRules } from '@commerce/core/segments'
import type { FilterGroup } from '@/components/table/filter-panel'
import { type CustomerSegment, customersContent } from '@/data/customers'
import { INDIAN_STATES } from '@/data/india'
import { formatPaise } from '@/lib/money'

const copy = customersContent.filters

export type CustomerFilterState = {
  stateCode: string
  minSpend: string
  maxSpend: string
  minOrders: string
  marketing: string
  /** 'yes' keeps business customers (a saved GSTIN), 'no' the rest. */
  business: string
  tag: string
}

export const EMPTY_CUSTOMER_FILTERS: CustomerFilterState = {
  stateCode: '',
  minSpend: '',
  maxSpend: '',
  minOrders: '',
  marketing: '',
  business: '',
  tag: '',
}

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
    business: f.business ? f.business === 'yes' : undefined,
    tag: f.tag || undefined,
  }
}

/** The panel's groups for the customer list; the chips and Clear all come from the same list. */
export function customerFilterGroups(
  f: CustomerFilterState,
  tags: string[],
  onChange: (patch: Partial<CustomerFilterState>) => void,
): FilterGroup[] {
  return [
    {
      key: 'state',
      label: copy.state,
      type: 'select',
      options: INDIAN_STATES.map((s) => ({ value: s.code, label: s.name })),
      value: f.stateCode || null,
      onChange: (next) => onChange({ stateCode: next ?? '' }),
      anyLabel: copy.anyState,
    },
    {
      key: 'spend',
      label: copy.spend,
      type: 'range',
      input: 'money',
      from: f.minSpend,
      to: f.maxSpend,
      fromLabel: copy.minSpend,
      toLabel: copy.maxSpend,
      format: (v) => formatPaise(paise(v) ?? 0),
      onChange: ({ from, to }) =>
        onChange({
          ...(from === undefined ? {} : { minSpend: from }),
          ...(to === undefined ? {} : { maxSpend: to }),
        }),
    },
    {
      key: 'orders',
      label: copy.orders,
      type: 'range',
      input: 'number',
      from: f.minOrders,
      onChange: ({ from }) => onChange({ minOrders: from ?? '' }),
    },
    {
      key: 'marketing',
      label: copy.marketing,
      type: 'select',
      options: [
        { value: 'yes', label: copy.marketingYes },
        { value: 'no', label: copy.marketingNo },
      ],
      value: f.marketing || null,
      onChange: (next) => onChange({ marketing: next ?? '' }),
      anyLabel: copy.marketingAny,
    },
    {
      key: 'business',
      label: copy.business,
      type: 'select',
      options: [
        { value: 'yes', label: copy.businessYes },
        { value: 'no', label: copy.businessNo },
      ],
      value: f.business || null,
      onChange: (next) => onChange({ business: next ?? '' }),
      anyLabel: copy.businessAny,
    },
    ...(tags.length > 0
      ? [
          {
            key: 'tag',
            label: copy.tag,
            type: 'select' as const,
            options: tags.map((t) => ({ value: t, label: t })),
            value: f.tag || null,
            onChange: (next: string | null) => onChange({ tag: next ?? '' }),
            anyLabel: copy.anyTag,
          },
        ]
      : []),
  ]
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
  if (f.business) {
    rules.conditions.push({ field: 'business', op: 'eq', value: String(f.business === 'yes') })
  }
  if (f.tag) rules.conditions.push({ field: 'tag', op: 'contains', value: f.tag })
  return rules
}
