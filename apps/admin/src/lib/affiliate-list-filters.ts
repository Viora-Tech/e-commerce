import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import type { affiliateFiltersContent } from '@/data/affiliate-filters'
import type { affiliatesContent } from '@/data/affiliates'
import type { filterPanelContent } from '@/data/filter-panel'
import {
  dateFilterBounds,
  hasDateFilter,
  NO_DATE_FILTER,
  parseAsDateFilter,
} from '@/lib/date-filter'
import {
  dateGroup,
  LAST_DAYS,
  lastDaysStart,
  paiseBound,
  windowInput,
  YES_NO,
  type YesNo,
  yesNoGroup,
  yesNoInput,
} from '@/lib/list-filter-parts'
import { formatPaise } from '@/lib/money'

/** As stored on the affiliate and on each commission. */
export const AFFILIATE_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const
type AffiliateStatus = (typeof AFFILIATE_STATUSES)[number]
export const COMMISSION_STATUSES = ['pending', 'approved', 'paid', 'reversed'] as const
type CommissionStatus = (typeof COMMISSION_STATUSES)[number]
export const COMMISSION_SOURCES = ['link', 'coupon', 'lifetime'] as const
type CommissionSource = (typeof COMMISSION_SOURCES)[number]

type Copy = typeof affiliatesContent
type FiltersCopy = typeof affiliateFiltersContent
type Panel = typeof filterPanelContent
type Option = { id: string; name: string }

/** A rupee range group (earned, commission) over two typed bounds. */
function moneyRange(
  key: string,
  label: string,
  from: string,
  to: string,
  panel: Panel,
  onChange: (patch: { from?: string; to?: string }) => void,
): FilterGroup {
  return {
    key,
    label,
    type: 'range',
    input: 'money',
    from,
    to,
    fromLabel: panel.min,
    toLabel: panel.max,
    format: (v) => formatPaise(paiseBound(v) ?? 0),
    onChange,
  }
}

/* ---------------------------------------------------------------- Affiliates */

/** What the Affiliates filter panel holds; arrays are "any of", empty for no filter. */
export type AffiliateFilters = {
  status: AffiliateStatus[]
  /** Program ids. */
  program: string[]
  joined: DateFilterValue
  /** Rupees as typed; empty for no bound. */
  earnedMin: string
  earnedMax: string
}

export const NO_AFFILIATE_FILTERS: AffiliateFilters = {
  status: [],
  program: [],
  joined: NO_DATE_FILTER,
  earnedMin: '',
  earnedMax: '',
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const AFFILIATE_FILTER_PARAMS = {
  status: parseAsArrayOf(parseAsStringLiteral(AFFILIATE_STATUSES)).withDefault([]),
  program: parseAsArrayOf(parseAsString).withDefault([]),
  joined: parseAsDateFilter(LAST_DAYS),
  earnedMin: parseAsString.withDefault(''),
  earnedMax: parseAsString.withDefault(''),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_AFFILIATE_FILTERS = {
  status: null,
  program: null,
  joined: null,
  earnedMin: null,
  earnedMax: null,
}

export function hasAffiliateFilters(f: AffiliateFilters): boolean {
  return (
    f.status.length > 0 ||
    f.program.length > 0 ||
    hasDateFilter(f.joined) ||
    paiseBound(f.earnedMin) !== null ||
    paiseBound(f.earnedMax) !== null
  )
}

/** The panel as `affiliates.list` input. */
export function affiliateFilterInput(f: AffiliateFilters, now = new Date()) {
  const min = paiseBound(f.earnedMin)
  const max = paiseBound(f.earnedMax)
  return {
    ...(f.status.length ? { statuses: f.status } : {}),
    ...(f.program.length ? { programIds: f.program } : {}),
    ...windowInput('joined', dateFilterBounds(f.joined, lastDaysStart, now)),
    ...(min === null ? {} : { minEarnedPaise: min }),
    ...(max === null ? {} : { maxEarnedPaise: max }),
  }
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function affiliateFilterGroups(
  f: AffiliateFilters,
  copy: Copy,
  filtersCopy: FiltersCopy,
  panel: Panel,
  programs: Option[],
  onChange: (patch: Partial<AffiliateFilters>) => void,
): FilterGroup[] {
  const l = filtersCopy.affiliates
  return [
    {
      key: 'status',
      label: l.status,
      type: 'checks',
      options: AFFILIATE_STATUSES.map((s) => ({ value: s, label: copy.status[s] ?? s })),
      value: f.status,
      onChange: (next) => onChange({ status: AFFILIATE_STATUSES.filter((s) => next.includes(s)) }),
    },
    {
      key: 'program',
      label: l.program,
      type: 'multi',
      options: programs.map((p) => ({ value: p.id, label: p.name })),
      value: f.program,
      onChange: (program) => onChange({ program }),
    },
    dateGroup('joined', l.joined, f.joined, (joined) => onChange({ joined }), panel),
    moneyRange('earned', l.earned, f.earnedMin, f.earnedMax, panel, ({ from, to }) =>
      onChange({
        ...(from === undefined ? {} : { earnedMin: from }),
        ...(to === undefined ? {} : { earnedMax: to }),
      }),
    ),
  ]
}

/* ---------------------------------------------------------------- Commissions */

/** What the Commissions filter panel holds; arrays are "any of", empty for no filter. */
export type CommissionFilters = {
  status: CommissionStatus[]
  source: CommissionSource[]
  /** Affiliate ids. */
  affiliate: string[]
  placed: DateFilterValue
  /** Rupees as typed; empty for no bound. */
  amountMin: string
  amountMax: string
  flagged: YesNo | null
}

export const NO_COMMISSION_FILTERS: CommissionFilters = {
  status: [],
  source: [],
  affiliate: [],
  placed: NO_DATE_FILTER,
  amountMin: '',
  amountMax: '',
  flagged: null,
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const COMMISSION_FILTER_PARAMS = {
  status: parseAsArrayOf(parseAsStringLiteral(COMMISSION_STATUSES)).withDefault([]),
  source: parseAsArrayOf(parseAsStringLiteral(COMMISSION_SOURCES)).withDefault([]),
  affiliate: parseAsArrayOf(parseAsString).withDefault([]),
  placed: parseAsDateFilter(LAST_DAYS),
  amountMin: parseAsString.withDefault(''),
  amountMax: parseAsString.withDefault(''),
  flagged: parseAsStringLiteral(YES_NO),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_COMMISSION_FILTERS = {
  status: null,
  source: null,
  affiliate: null,
  placed: null,
  amountMin: null,
  amountMax: null,
  flagged: null,
}

export function hasCommissionFilters(f: CommissionFilters): boolean {
  return (
    f.status.length > 0 ||
    f.source.length > 0 ||
    f.affiliate.length > 0 ||
    hasDateFilter(f.placed) ||
    paiseBound(f.amountMin) !== null ||
    paiseBound(f.amountMax) !== null ||
    f.flagged !== null
  )
}

/** The panel as `affiliates.commissions.list` input. */
export function commissionFilterInput(f: CommissionFilters, now = new Date()) {
  const min = paiseBound(f.amountMin)
  const max = paiseBound(f.amountMax)
  const flagged = yesNoInput(f.flagged)
  return {
    ...(f.status.length ? { statuses: f.status } : {}),
    ...(f.source.length ? { sources: f.source } : {}),
    ...(f.affiliate.length ? { affiliateIds: f.affiliate } : {}),
    ...windowInput('placed', dateFilterBounds(f.placed, lastDaysStart, now)),
    ...(min === null ? {} : { minCommissionPaise: min }),
    ...(max === null ? {} : { maxCommissionPaise: max }),
    ...(flagged === undefined ? {} : { flagged }),
  }
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function commissionFilterGroups(
  f: CommissionFilters,
  copy: Copy,
  filtersCopy: FiltersCopy,
  panel: Panel,
  affiliates: Option[],
  onChange: (patch: Partial<CommissionFilters>) => void,
): FilterGroup[] {
  const c = filtersCopy.commissions
  return [
    {
      key: 'status',
      label: c.status,
      type: 'checks',
      options: COMMISSION_STATUSES.map((s) => ({ value: s, label: copy.commissionStatus[s] ?? s })),
      value: f.status,
      onChange: (next) => onChange({ status: COMMISSION_STATUSES.filter((s) => next.includes(s)) }),
    },
    {
      key: 'source',
      label: c.source,
      type: 'checks',
      options: COMMISSION_SOURCES.map((s) => ({ value: s, label: copy.source[s] ?? s })),
      value: f.source,
      onChange: (next) => onChange({ source: COMMISSION_SOURCES.filter((s) => next.includes(s)) }),
    },
    {
      key: 'affiliate',
      label: c.affiliate,
      type: 'multi',
      options: affiliates.map((a) => ({ value: a.id, label: a.name })),
      value: f.affiliate,
      onChange: (affiliate) => onChange({ affiliate }),
    },
    dateGroup('placed', c.placed, f.placed, (placed) => onChange({ placed }), panel),
    moneyRange('amount', c.amount, f.amountMin, f.amountMax, panel, ({ from, to }) =>
      onChange({
        ...(from === undefined ? {} : { amountMin: from }),
        ...(to === undefined ? {} : { amountMax: to }),
      }),
    ),
    yesNoGroup('flagged', c.flagged, f.flagged, (flagged) => onChange({ flagged })),
  ]
}
