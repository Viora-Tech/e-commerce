import type { FormErrors } from './form-state'

/** Tabs in page order. Pricing and inventory move into the variants table once options exist. */
export const SINGLE_TABS = [
  'media',
  'details',
  'pricing',
  'inventory',
  'variants',
  'shipping',
  'seo',
  'more',
] as const
export const MATRIX_TABS = ['media', 'details', 'variants', 'shipping', 'seo', 'more'] as const

export type ProductTabId = (typeof SINGLE_TABS)[number]

export function tabsFor(single: boolean): readonly ProductTabId[] {
  return single ? SINGLE_TABS : MATRIX_TABS
}

/** The tab that holds the field a validation error belongs to. */
export function tabOfError(key: keyof FormErrors, single: boolean): ProductTabId {
  if (key === 'title') return 'details'
  if (key === 'package') return 'shipping'
  if (key === 'preorderDeposit') return 'more'
  return single ? 'pricing' : 'variants'
}

/** Tabs holding at least one error, in tab order. */
export function tabsWithErrors(errors: FormErrors, single: boolean): ProductTabId[] {
  const hit = new Set(
    (Object.keys(errors) as (keyof FormErrors)[]).map((key) => tabOfError(key, single)),
  )
  return tabsFor(single).filter((id) => hit.has(id))
}
