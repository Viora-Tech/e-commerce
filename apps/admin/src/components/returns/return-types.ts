import type { api } from '@/lib/api-client'

/** The admin return detail, as `returns.get` sends it. */
export type ReturnDetail = NonNullable<Awaited<ReturnType<typeof api.returns.get>>>

export type PickupChoice =
  | { method: 'courier'; providerId: string }
  | { method: 'customer' }
  | { method: 'later' }

/** Rupees typed by the merchant to paise; NaN for junk. */
export function toPaise(rupees: string): number {
  return Math.round(Number.parseFloat(rupees) * 100)
}

/** Paise to the rupee string an amount field shows. */
export function toRupees(paise: number): string {
  return String(paise / 100)
}
