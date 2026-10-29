import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import { type FilterGroup, facetOptions } from '@/components/table/filter-panel'
import type { suppliersContent } from '@/data/purchasing'
import { YES_NO, type YesNo, yesNoGroup, yesNoInput } from '@/lib/list-filter-parts'

/** What the Suppliers filter panel holds; arrays are "any of", empty for no filter. */
export type SupplierFilters = {
  /** ISO alpha-2 codes. */
  country: string[]
  currency: string[]
  gstin: YesNo | null
  orders: YesNo | null
}

export const NO_SUPPLIER_FILTERS: SupplierFilters = {
  country: [],
  currency: [],
  gstin: null,
  orders: null,
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const SUPPLIER_FILTER_PARAMS = {
  country: parseAsArrayOf(parseAsString).withDefault([]),
  currency: parseAsArrayOf(parseAsString).withDefault([]),
  gstin: parseAsStringLiteral(YES_NO),
  orders: parseAsStringLiteral(YES_NO),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_SUPPLIER_FILTERS = { country: null, currency: null, gstin: null, orders: null }

export function hasSupplierFilters(f: SupplierFilters): boolean {
  return f.country.length > 0 || f.currency.length > 0 || f.gstin !== null || f.orders !== null
}

/** The panel as `suppliers.list` input. */
export function supplierFilterInput(f: SupplierFilters) {
  const gstin = yesNoInput(f.gstin)
  const orders = yesNoInput(f.orders)
  return {
    ...(f.country.length ? { countries: f.country } : {}),
    ...(f.currency.length ? { currencies: f.currency } : {}),
    ...(gstin === undefined ? {} : { hasGstin: gstin }),
    ...(orders === undefined ? {} : { hasOrders: orders }),
  }
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function supplierFilterGroups(
  f: SupplierFilters,
  copy: (typeof suppliersContent)['filters'],
  facets: { countries: string[]; currencies: string[] },
  onChange: (patch: Partial<SupplierFilters>) => void,
): FilterGroup[] {
  return [
    {
      key: 'country',
      label: copy.country,
      type: 'multi',
      options: facetOptions(facets.countries),
      value: f.country,
      onChange: (country) => onChange({ country }),
    },
    {
      key: 'currency',
      label: copy.currency,
      type: 'multi',
      options: facetOptions(facets.currencies),
      value: f.currency,
      onChange: (currency) => onChange({ currency }),
    },
    yesNoGroup('gstin', copy.gstin, f.gstin, (gstin) => onChange({ gstin })),
    yesNoGroup('orders', copy.orders, f.orders, (orders) => onChange({ orders })),
  ]
}
