import { parseRupees } from '@commerce/money'
import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import type { giftCardsContent } from '@/data/gift-cards'
import { dateFilterBounds, hasDateFilter, parseAsDateFilter } from '@/lib/date-filter'
import { formatPaise } from '@/lib/money'

export const SOURCE_FILTERS = ['manual', 'purchase'] as const
export const ISSUED_FILTERS = ['7d', '30d', '90d'] as const
type IssuedFilter = (typeof ISSUED_FILTERS)[number]

const DAYS: Record<IssuedFilter, number> = { '7d': 7, '30d': 30, '90d': 90 }

/** The Gift cards filter panel. */
export type GiftCardFilters = {
  source: (typeof SOURCE_FILTERS)[number][]
  /** Rupees as typed; empty for no bound. */
  minBalance: string
  maxBalance: string
  issued: DateFilterValue
  /** A custom from–to only: expiry runs into the future, so past presets don't fit. */
  expires: DateFilterValue
}

export const GIFT_CARD_FILTER_PARAMS = {
  source: parseAsArrayOf(parseAsStringLiteral(SOURCE_FILTERS)).withDefault([]),
  minBalance: parseAsString.withDefault(''),
  maxBalance: parseAsString.withDefault(''),
  issued: parseAsDateFilter(ISSUED_FILTERS),
  expires: parseAsDateFilter([]),
}

export const CLEAR_GIFT_CARD_FILTERS = {
  source: null,
  minBalance: null,
  maxBalance: null,
  issued: null,
  expires: null,
}

function presetStart(preset: string, now: Date): Date | null {
  const issued = ISSUED_FILTERS.find((i) => i === preset)
  return issued ? new Date(now.getTime() - DAYS[issued] * 86_400_000) : null
}

export function hasGiftCardFilters(f: GiftCardFilters): boolean {
  return (
    f.source.length > 0 ||
    parseRupees(f.minBalance) !== null ||
    parseRupees(f.maxBalance) !== null ||
    hasDateFilter(f.issued) ||
    hasDateFilter(f.expires)
  )
}

/** The panel as `giftCards.list` input. */
export function giftCardFilterInput(f: GiftCardFilters, now = new Date()) {
  const issued = dateFilterBounds(f.issued, presetStart, now)
  const min = parseRupees(f.minBalance)
  const max = parseRupees(f.maxBalance)
  return {
    ...(f.source.length ? { source: f.source } : {}),
    ...(min !== null ? { minBalancePaise: Math.max(0, min) } : {}),
    ...(max !== null ? { maxBalancePaise: Math.max(0, max) } : {}),
    ...(issued.from ? { createdFrom: issued.from } : {}),
    ...(issued.to ? { createdTo: issued.to } : {}),
    // Expiry is a store day, so the typed days go as they are.
    ...(hasDateFilter(f.expires) && f.expires.from ? { expiresFrom: f.expires.from } : {}),
    ...(hasDateFilter(f.expires) && f.expires.to ? { expiresTo: f.expires.to } : {}),
  }
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function giftCardFilterGroups(
  f: GiftCardFilters,
  copy: (typeof giftCardsContent)['filters'],
  onChange: (patch: Partial<GiftCardFilters>) => void,
): FilterGroup[] {
  return [
    {
      key: 'source',
      label: copy.source,
      type: 'checks',
      options: SOURCE_FILTERS.map((s) => ({ value: s, label: copy.sourceOptions[s] })),
      value: f.source,
      onChange: (next) => onChange({ source: SOURCE_FILTERS.filter((s) => next.includes(s)) }),
    },
    {
      key: 'balance',
      label: copy.balance,
      type: 'range',
      input: 'money',
      from: f.minBalance,
      to: f.maxBalance,
      fromLabel: copy.minBalance,
      toLabel: copy.maxBalance,
      format: (v) => formatPaise(parseRupees(v) ?? 0),
      onChange: ({ from, to }) =>
        onChange({
          ...(from === undefined ? {} : { minBalance: from }),
          ...(to === undefined ? {} : { maxBalance: to }),
        }),
    },
    {
      key: 'issued',
      label: copy.issued,
      type: 'date',
      presets: ISSUED_FILTERS.map((i) => ({ value: i, label: copy.issuedOptions[i] })),
      value: f.issued,
      onChange: (issued) => onChange({ issued }),
      anyLabel: copy.anyDate,
    },
    {
      key: 'expires',
      label: copy.expires,
      type: 'date',
      presets: [],
      value: f.expires,
      onChange: (expires) => onChange({ expires }),
      anyLabel: copy.anyDate,
    },
  ]
}
