import type { saleSourceContent } from '@/data/sale-source'

/** The stored touch (`order.attribution`, `cart.attribution`), as the API returns it. */
export type SaleAttribution = {
  channel: string
  source?: string | undefined
  medium?: string | undefined
  campaign?: string | undefined
  referrer?: string | undefined
  landing?: string | undefined
  ref?: string | undefined
  at?: string | undefined
}

export type SaleSourceRow = { key: string; label: string; value: string }

type Copy = typeof saleSourceContent

/** "google / cpc", or just the one that is there; null when the visit carried no UTM tags. */
export function sourceMedium(a: SaleAttribution): string | null {
  if (!a.source && !a.medium) return null
  return [a.source ?? '', a.medium ?? ''].filter(Boolean).join(' / ')
}

/**
 * The card's rows for a recorded touch, in reading order: the channel always, then only what
 * was recorded (the referring site, UTM source / medium and campaign, the first page, an
 * affiliate's code). The visit time is the component's, as it needs the member's formatter.
 */
export function saleSourceRows(a: SaleAttribution, copy: Copy): SaleSourceRow[] {
  const channel = copy.channels[a.channel as keyof Copy['channels']] ?? a.channel
  const rows: (SaleSourceRow | null)[] = [
    { key: 'channel', label: copy.channel, value: channel },
    a.referrer ? { key: 'cameFrom', label: copy.cameFrom, value: a.referrer } : null,
    sourceMedium(a)
      ? { key: 'sourceMedium', label: copy.sourceMedium, value: sourceMedium(a) as string }
      : null,
    a.campaign ? { key: 'campaign', label: copy.campaign, value: a.campaign } : null,
    a.landing ? { key: 'landing', label: copy.landing, value: a.landing } : null,
    a.ref ? { key: 'affiliate', label: copy.affiliate, value: a.ref } : null,
  ]
  return rows.filter((r): r is SaleSourceRow => r !== null)
}
