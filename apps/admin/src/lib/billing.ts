import { siteConfig } from '@commerce/config/site'

const DAY_MS = 86_400_000

/** Whole days from `now` until `at` (0 once it has passed). */
export function daysUntil(at: Date | string | null, now = new Date()): number {
  if (!at) return 0
  return Math.max(0, Math.ceil((new Date(at).getTime() - now.getTime()) / DAY_MS))
}

/** 0–100 for a usage bar; a missing limit reads as empty. */
export function usageShare(used: number, limit: number | null): number {
  if (!limit) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

/** Bytes as GB with one decimal, for "2.1 GB of 10 GB". */
export const bytesToGb = (bytes: number): string => (bytes / 1024 ** 3).toFixed(1)

/** Where "Talk to us" on Own it goes: the platform's WhatsApp with a short greeting. */
export const ownItContactUrl = (): string =>
  `https://wa.me/${siteConfig.contact.whatsappNumber}?text=${encodeURIComponent(
    `Hi, I would like to know about owning ${siteConfig.brand.name} (Own it).`,
  )}`

/** A fee in basis points as the percent people read: 100 → "1", 75 → "0.75". */
export const feePercent = (basisPoints: number): string => String(basisPoints / 100)
