/**
 * Sweep: status lists in UI code. Order lifecycle/payment/fulfilment statuses, order marks,
 * open payment attempts, purchase-order and transfer statuses each have one list in core
 * (`@commerce/core/order-status`, `@commerce/core/inventory`). UI code (admin, storefront,
 * blocks) must read those lists, not restate them as a literal array, and must not import a
 * `...Status` type straight from the database schema (`@commerce/db`): take it from core.
 *
 * Ratchet: a NEW restated list or schema status import fails (stale entries fail too).
 */
import { describe, expect, it } from 'vitest'
import {
  PURCHASE_ORDER_STATUSES,
  TRANSFER_STATUSES,
} from '../../packages/core/src/inventory/client'
import {
  OPEN_ATTEMPT_STATUSES,
  ORDER_FULFILLMENT_STATUSES,
  ORDER_LIFECYCLE_STATUSES,
  ORDER_MARKS,
  ORDER_PAYMENT_STATUSES,
} from '../../packages/core/src/order/aggregate-status'
import { statusLiteralSites } from './consistency'

const CORE_STATUS_LISTS = [
  OPEN_ATTEMPT_STATUSES,
  ORDER_FULFILLMENT_STATUSES,
  ORDER_LIFECYCLE_STATUSES,
  ORDER_MARKS,
  ORDER_PAYMENT_STATUSES,
  PURCHASE_ORDER_STATUSES,
  TRANSFER_STATUSES,
]

type AllowEntry = { site: string; reason: string }

const ALLOWLIST: AllowEntry[] = []

describe('sweep: status-literals', () => {
  it('UI code takes status lists and types from core', async () => {
    const sites = await statusLiteralSites(CORE_STATUS_LISTS)
    const unlisted = sites.filter((s) => !ALLOWLIST.some((e) => e.site === s))
    expect(
      unlisted,
      `import the list or type from @commerce/core instead:\n${unlisted.join('\n')}`,
    ).toEqual([])
  })

  it('the allow-list has no stale entries', async () => {
    const sites = await statusLiteralSites(CORE_STATUS_LISTS)
    expect(ALLOWLIST.filter((e) => !sites.includes(e.site))).toEqual([])
  })
})
