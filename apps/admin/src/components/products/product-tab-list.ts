import type { FormErrors } from './form-state'

/** Tabs in page order (Figma 631:7713 / 631:11672). A product without options prices itself on
 *  "Price & stock"; once options exist that moves into the variants table. */
export const SINGLE_TABS = ['overview', 'price', 'shipping', 'seo', 'more'] as const
export const MATRIX_TABS = ['overview', 'variants', 'shipping', 'seo', 'more'] as const

export type ProductTabId = (typeof SINGLE_TABS)[number] | (typeof MATRIX_TABS)[number]

/** Tab ids from before the merge, so old links (?tab=pricing) still land somewhere sensible. */
const RENAMED: Record<string, ProductTabId> = {
  media: 'overview',
  details: 'overview',
  pricing: 'price',
  inventory: 'price',
}

export function tabsFor(single: boolean): readonly ProductTabId[] {
  return single ? SINGLE_TABS : MATRIX_TABS
}

/** The tab a `?tab=` value opens, or the first tab when it names none of them. */
export function tabFromParam(param: string | null, single: boolean): ProductTabId {
  const tabs = tabsFor(single)
  const wanted = param ? (RENAMED[param] ?? param) : null
  const swapped = wanted === 'price' && !single ? 'variants' : wanted
  return tabs.find((id) => id === swapped) ?? tabs[0] ?? 'overview'
}

/** The tab that holds the field a validation error belongs to. */
export function tabOfError(key: keyof FormErrors, single: boolean): ProductTabId {
  if (key === 'title') return 'overview'
  if (key === 'package') return 'shipping'
  if (key === 'preorderDeposit') return 'more'
  return single ? 'price' : 'variants'
}

/** Tabs holding at least one error, in tab order. */
export function tabsWithErrors(errors: FormErrors, single: boolean): ProductTabId[] {
  const hit = new Set(
    (Object.keys(errors) as (keyof FormErrors)[]).map((key) => tabOfError(key, single)),
  )
  return tabsFor(single).filter((id) => hit.has(id))
}
