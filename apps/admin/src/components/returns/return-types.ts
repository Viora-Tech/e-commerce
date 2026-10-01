import type { api } from '@/lib/api-client'

/** The admin return detail, as `returns.get` sends it. */
export type ReturnDetail = NonNullable<Awaited<ReturnType<typeof api.returns.get>>>

export type PickupChoice =
  | { method: 'courier'; providerId: string }
  | { method: 'customer' }
  | { method: 'later' }

/** Paise to the rupee string an amount field shows. */
export function toRupees(paise: number): string {
  return String(paise / 100)
}
