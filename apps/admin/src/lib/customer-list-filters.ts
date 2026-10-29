import type { SegmentRules } from '@commerce/core/segments'
import { parseRupees } from '@commerce/money'
import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import {
  type DateFilterValue,
  type FilterGroup,
  facetOptions,
} from '@/components/table/filter-panel'
import type { CustomerSegment, customersContent } from '@/data/customers'
import { INDIAN_STATES } from '@/data/india'
import {
  dateFilterBounds,
  hasDateFilter,
  NO_DATE_FILTER,
  parseAsDateFilter,
} from '@/lib/date-filter'
import { formatPaise } from '@/lib/money'

/** The Created and Last order presets; a custom from–to is the date group's own option. */
export const CUSTOMER_DATE_FILTERS = ['7d', '30d', '90d'] as const
type CustomerDateFilter = (typeof CUSTOMER_DATE_FILTERS)[number]

const DAYS: Record<CustomerDateFilter, number> = { '7d': 7, '30d': 30, '90d': 90 }

const YES_NO = ['yes', 'no'] as const
/** "yes", "no", or null for either. */
type YesNo = (typeof YES_NO)[number] | null

/** What the Customers filter panel holds; arrays are "any of", empty for no filter. */
export type CustomerFilters = {
  /** Two-letter state codes of the default address. */
  state: string[]
  tag: string[]
  /** Rupees as typed; empty for no bound. */
  spendMin: string
  spendMax: string
  /** Whole numbers as typed; empty for no bound. */
  ordersMin: string
  ordersMax: string
  created: DateFilterValue
  lastOrder: DateFilterValue
  /** Marketing consent per channel. */
  email: YesNo
  sms: YesNo
  whatsapp: YesNo
  /** "yes" keeps business customers (a saved GSTIN), "no" the rest. */
  business: YesNo
}

export const NO_CUSTOMER_FILTERS: CustomerFilters = {
  state: [],
  tag: [],
  spendMin: '',
  spendMax: '',
  ordersMin: '',
  ordersMax: '',
  created: NO_DATE_FILTER,
  lastOrder: NO_DATE_FILTER,
  email: null,
  sms: null,
  whatsapp: null,
  business: null,
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const CUSTOMER_FILTER_PARAMS = {
  state: parseAsArrayOf(parseAsString).withDefault([]),
  tag: parseAsArrayOf(parseAsString).withDefault([]),
  spendMin: parseAsString.withDefault(''),
  spendMax: parseAsString.withDefault(''),
  ordersMin: parseAsString.withDefault(''),
  ordersMax: parseAsString.withDefault(''),
  created: parseAsDateFilter(CUSTOMER_DATE_FILTERS),
  lastOrder: parseAsDateFilter(CUSTOMER_DATE_FILTERS),
  email: parseAsStringLiteral(YES_NO),
  sms: parseAsStringLiteral(YES_NO),
  whatsapp: parseAsStringLiteral(YES_NO),
  business: parseAsStringLiteral(YES_NO),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_CUSTOMER_FILTERS = {
  state: null,
  tag: null,
  spendMin: null,
  spendMax: null,
  ordersMin: null,
  ordersMax: null,
  created: null,
  lastOrder: null,
  email: null,
  sms: null,
  whatsapp: null,
  business: null,
}

function whole(text: string): number | null {
  const n = Number.parseInt(text, 10)
  return Number.isFinite(n) ? Math.max(0, n) : null
}

function paise(text: string): number | null {
  const n = parseRupees(text)
  return n === null ? null : Math.max(0, n)
}

function yesNo(v: YesNo): boolean | undefined {
  return v === null ? undefined : v === 'yes'
}

function presetDays(preset: string | null): number | null {
  const found = CUSTOMER_DATE_FILTERS.find((p) => p === preset)
  return found ? DAYS[found] : null
}

function presetStart(preset: string, now: Date): Date | null {
  const days = presetDays(preset)
  return days === null ? null : new Date(now.getTime() - days * 86_400_000)
}

export function hasCustomerFilters(f: CustomerFilters): boolean {
  return (
    f.state.length > 0 ||
    f.tag.length > 0 ||
    paise(f.spendMin) !== null ||
    paise(f.spendMax) !== null ||
    whole(f.ordersMin) !== null ||
    whole(f.ordersMax) !== null ||
    hasDateFilter(f.created) ||
    hasDateFilter(f.lastOrder) ||
    f.email !== null ||
    f.sms !== null ||
    f.whatsapp !== null ||
    f.business !== null
  )
}

/** The panel as `customers.list` and `customers.export` input. */
export function customerFilterInput(f: CustomerFilters, now = new Date()) {
  const created = dateFilterBounds(f.created, presetStart, now)
  const lastOrder = dateFilterBounds(f.lastOrder, presetStart, now)
  const spendMin = paise(f.spendMin)
  const spendMax = paise(f.spendMax)
  const ordersMin = whole(f.ordersMin)
  const ordersMax = whole(f.ordersMax)
  const email = yesNo(f.email)
  const sms = yesNo(f.sms)
  const whatsapp = yesNo(f.whatsapp)
  const business = yesNo(f.business)
  return {
    ...(f.state.length ? { stateCodes: f.state } : {}),
    ...(f.tag.length ? { tags: f.tag } : {}),
    ...(spendMin !== null ? { minSpentPaise: spendMin } : {}),
    ...(spendMax !== null ? { maxSpentPaise: spendMax } : {}),
    ...(ordersMin !== null ? { minOrders: ordersMin } : {}),
    ...(ordersMax !== null ? { maxOrders: ordersMax } : {}),
    ...(created.from ? { createdFrom: created.from } : {}),
    ...(created.to ? { createdTo: created.to } : {}),
    ...(lastOrder.from ? { lastOrderFrom: lastOrder.from } : {}),
    ...(lastOrder.to ? { lastOrderTo: lastOrder.to } : {}),
    ...(email !== undefined ? { acceptsMarketing: email } : {}),
    ...(sms !== undefined ? { acceptsSms: sms } : {}),
    ...(whatsapp !== undefined ? { acceptsWhatsapp: whatsapp } : {}),
    ...(business !== undefined ? { business } : {}),
  }
}

/** A yes/no group's patch value from the panel's true/false/null. */
function toYesNo(next: boolean | null): YesNo {
  return next === null ? null : next ? 'yes' : 'no'
}

function fromYesNo(v: YesNo): boolean | null {
  return v === null ? null : v === 'yes'
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function customerFilterGroups(
  f: CustomerFilters,
  copy: (typeof customersContent)['filters'],
  tags: string[],
  onChange: (patch: Partial<CustomerFilters>) => void,
): FilterGroup[] {
  const datePresets = CUSTOMER_DATE_FILTERS.map((p) => ({
    value: p,
    label: copy.dateOptions[p],
  }))
  return [
    {
      key: 'state',
      label: copy.state,
      type: 'multi',
      options: INDIAN_STATES.map((s) => ({ value: s.code, label: s.name })),
      value: f.state,
      onChange: (state) => onChange({ state }),
    },
    ...(tags.length > 0
      ? [
          {
            key: 'tag',
            label: copy.tag,
            type: 'multi' as const,
            options: facetOptions(tags),
            value: f.tag,
            onChange: (tag: string[]) => onChange({ tag }),
          },
        ]
      : []),
    {
      key: 'spend',
      label: copy.spend,
      type: 'range',
      input: 'money',
      from: f.spendMin,
      to: f.spendMax,
      fromLabel: copy.minSpend,
      toLabel: copy.maxSpend,
      format: (v) => formatPaise(parseRupees(v) ?? 0),
      onChange: ({ from, to }) =>
        onChange({
          ...(from === undefined ? {} : { spendMin: from }),
          ...(to === undefined ? {} : { spendMax: to }),
        }),
    },
    {
      key: 'orders',
      label: copy.orders,
      type: 'range',
      input: 'number',
      from: f.ordersMin,
      to: f.ordersMax,
      fromLabel: copy.minOrders,
      toLabel: copy.maxOrders,
      onChange: ({ from, to }) =>
        onChange({
          ...(from === undefined ? {} : { ordersMin: from }),
          ...(to === undefined ? {} : { ordersMax: to }),
        }),
    },
    {
      key: 'created',
      label: copy.created,
      type: 'date',
      presets: datePresets,
      value: f.created,
      onChange: (created) => onChange({ created }),
      anyLabel: copy.anyDate,
    },
    {
      key: 'lastOrder',
      label: copy.lastOrder,
      type: 'date',
      presets: datePresets,
      value: f.lastOrder,
      onChange: (lastOrder) => onChange({ lastOrder }),
      anyLabel: copy.anyDate,
    },
    {
      key: 'email',
      label: copy.emailConsent,
      type: 'boolean',
      value: fromYesNo(f.email),
      onChange: (next) => onChange({ email: toYesNo(next) }),
      yesLabel: copy.subscribed,
      noLabel: copy.notSubscribed,
    },
    {
      key: 'sms',
      label: copy.smsConsent,
      type: 'boolean',
      value: fromYesNo(f.sms),
      onChange: (next) => onChange({ sms: toYesNo(next) }),
      yesLabel: copy.subscribed,
      noLabel: copy.notSubscribed,
    },
    {
      key: 'whatsapp',
      label: copy.whatsappConsent,
      type: 'boolean',
      value: fromYesNo(f.whatsapp),
      onChange: (next) => onChange({ whatsapp: toYesNo(next) }),
      yesLabel: copy.subscribed,
      noLabel: copy.notSubscribed,
    },
    {
      key: 'business',
      label: copy.business,
      type: 'boolean',
      value: fromYesNo(f.business),
      onChange: (next) => onChange({ business: toYesNo(next) }),
      yesLabel: copy.businessYes,
      noLabel: copy.businessNo,
    },
  ]
}

type Condition = SegmentRules['conditions'][number]

/**
 * The current filter as segment rules, so "Save as segment" opens a filled builder. Segments
 * match every condition, so a multi-pick goes in only with one value; dates go in only as a
 * Last order preset ("ordered in the last 30 days"). SMS, WhatsApp and Created have no
 * segment condition yet.
 */
export function segmentRulesFromFilters(
  f: CustomerFilters,
  segment: CustomerSegment | null,
): SegmentRules {
  const rules: SegmentRules = { match: 'all', conditions: [] }
  const add = (field: Condition['field'], op: Condition['op'], value: string) =>
    rules.conditions.push({ field, op, value })
  const [state] = f.state
  if (f.state.length === 1 && state) add('state', 'eq', state)
  const spendMin = paise(f.spendMin)
  if (spendMin !== null) add('spend', 'gte', String(spendMin))
  const spendMax = paise(f.spendMax)
  if (spendMax !== null) add('spend', 'lte', String(spendMax))
  const ordersMin = whole(f.ordersMin)
  if (ordersMin !== null) add('orders', 'gte', String(ordersMin))
  else if (segment === 'returning') add('orders', 'gte', '2')
  const ordersMax = whole(f.ordersMax)
  if (ordersMax !== null) add('orders', 'lte', String(ordersMax))
  const lastOrderDays = presetDays(f.lastOrder.preset)
  if (lastOrderDays !== null) add('last_order_days', 'lte', String(lastOrderDays))
  if (f.email !== null || segment === 'subscribed') {
    add('marketing', 'eq', String(f.email === null ? true : f.email === 'yes'))
  }
  if (f.business !== null) add('business', 'eq', String(f.business === 'yes'))
  const [tag] = f.tag
  if (f.tag.length === 1 && tag) add('tag', 'contains', tag)
  return rules
}
