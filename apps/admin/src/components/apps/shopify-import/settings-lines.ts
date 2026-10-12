import type {
  SettingsAction,
  SettingsItem,
  SettingsRatePreview,
} from '@commerce/plugin-shopify-import/client'
import type { shopifyImportSettingsContent } from '@/data/shopify-import-settings'
import type { Formatters } from '@/lib/format'

type Copy = typeof shopifyImportSettingsContent

/** Badge colour per action. */
export const ACTION_VARIANT: Record<
  SettingsAction,
  'success' | 'info' | 'neutral' | 'warning' | 'destructive'
> = {
  create: 'success',
  update: 'info',
  same: 'neutral',
  conflict: 'destructive',
  manual: 'warning',
  warn: 'warning',
}

/** One rate in plain words: "Standard: ₹49 for orders under ₹499". Bounds show as Shopify set them. */
export function rateText(r: SettingsRatePreview, copy: Copy, fmt: Formatters): string {
  const price = r.pricePaise === 0 ? copy.rates.free : fmt.money(r.pricePaise)
  // Our upper bound is excluded; Shopify's (shown here) was included, one paisa or gram lower.
  const upper = r.max === null ? null : r.max - 1
  const grams = (g: number) => copy.rates.grams(fmt.number(g))
  let text = r.pricePaise === 0 ? price : copy.rates.flat(price)
  if (r.condition === 'order_value') {
    if (r.min !== null && upper !== null)
      text = copy.rates.orderValue(price, fmt.money(r.min), fmt.money(upper))
    else if (r.min !== null) text = copy.rates.orderOver(price, fmt.money(r.min))
    else if (upper !== null) text = copy.rates.orderUnder(price, fmt.money(upper))
  } else if (r.condition === 'weight') {
    if (r.min !== null && upper !== null)
      text = copy.rates.weight(price, grams(r.min), grams(upper))
    else if (r.min !== null) text = copy.rates.weightOver(price, grams(r.min))
    else if (upper !== null) text = copy.rates.weightUnder(price, grams(upper))
  }
  return `${r.name}: ${text}`
}

const shown = (value: string | null | undefined, copy: Copy) =>
  value === 'on' ? copy.on : value === 'off' ? copy.off : (value ?? '')

/** The line's heading ("Location: Bengaluru warehouse") and what it says about it. */
export function itemText(
  item: SettingsItem,
  copy: Copy,
  fmt: Formatters,
): { title: string; detail: string | null } {
  const subject = copy.subjects[item.subject]
  const owner = item.owner ? (copy.owners[item.owner] ?? item.owner) : null
  const title = [owner ?? subject, item.name].filter(Boolean).join(': ')
  if (item.reason) {
    const name = item.name ?? owner ?? subject
    return {
      title,
      detail: copy.reasons[item.reason]({
        name,
        detail: item.detail ?? '',
        from: shown(item.from, copy),
        to: shown(item.to, copy),
      }),
    }
  }
  if (item.rates)
    return { title, detail: item.rates.map((r) => rateText(r, copy, fmt)).join(' · ') }
  if (item.subject === 'field') return { title, detail: null }
  if (item.action === 'update' && item.from) {
    return { title, detail: `${shown(item.from, copy)} → ${shown(item.to, copy)}` }
  }
  return { title, detail: item.to ? shown(item.to, copy) : null }
}
