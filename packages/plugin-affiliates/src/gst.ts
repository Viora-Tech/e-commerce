/** SOURCE OF TRUTH: GST on affiliate payouts — WHAT: the GST added for a GST-registered affiliate and the amount to pay / WHY: the payouts page, the bank file and the payout row must agree to the paisa */
import type { StoreAffiliateSettings } from './settings'

/**
 * Pure. A GST-registered affiliate invoices GST on their commission and the store claims the
 * input tax credit, so the GST is added on top of the payout (default 18%, a research note:
 * the merchant's CA should confirm). It is on the commission less clawbacks. TDS stays on the
 * commission without GST, as deducted at credit.
 */
export function payoutGstPaise(
  gst: StoreAffiliateSettings['gst'],
  gstRegistered: boolean,
  commissionPaise: number,
): number {
  if (!gst.enabled || !gstRegistered || commissionPaise <= 0) return 0
  return Math.round((commissionPaise * gst.bp) / 10_000)
}

/** What the merchant pays: commission, less clawbacks, plus GST, less TDS. Never below zero. */
export function payoutNetPaise(a: {
  grossPaise: number
  clawbackPaise: number
  gstPaise: number
  tdsPaise: number
}): number {
  return Math.max(0, a.grossPaise - a.clawbackPaise + a.gstPaise - a.tdsPaise)
}
