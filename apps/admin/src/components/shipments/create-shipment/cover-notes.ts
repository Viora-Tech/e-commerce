import type { CourierRateRow } from '@commerce/core'
import { coveredPaise } from '@commerce/core/delhivery-protect'

/**
 * What the drawer says about a courier's cover for this parcel. `coveredPaise`: what the
 * insurance pays at most (the value, or the courier's cap when lower: Delhivery Protect ₹30,000).
 * `uninsuredLimitPaise`: set when insurance is off and the parcel is worth more than the courier
 * refunds uninsured (Shiprocket ₹2,500). `usedNotCovered`: insurance is on but the parcel holds
 * an open-box or used product this courier does not cover. `deductibleBps`: the claim excess.
 */
export type CoverNotes = {
  valuePaise: number
  coveredPaise: number
  capped: boolean
  uninsuredLimitPaise: number | null
  usedNotCovered: boolean
  deductibleBps: number | null
}

export function coverNotes(
  row: Pick<CourierRateRow, 'cover'> | null | undefined,
  insured: boolean,
  fallbackValuePaise: number,
): CoverNotes {
  const c = row?.cover
  const value = c?.valuePaise ?? fallbackValuePaise
  const covered = coveredPaise(value, c?.coverCapPaise ?? null)
  const limit = c?.uninsuredLimitPaise ?? null
  return {
    valuePaise: value,
    coveredPaise: covered,
    capped: covered < value,
    uninsuredLimitPaise: !insured && limit !== null && value > limit ? limit : null,
    usedNotCovered: insured && c?.excludesUsed === true && c.hasUsedItems,
    deductibleBps: c?.deductibleBps ?? null,
  }
}
