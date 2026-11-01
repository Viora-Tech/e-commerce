/** Settings → Payments: saving a manual way to pay (UPI ID or bank transfer row). Split out of payments-setup.service.ts. */
import {
  anyManualRowLive,
  type ManualRow,
  type ManualRowId,
  type ManualRows,
  manualRowOn,
  manualRowReady,
  type PaymentAdjustment,
  type PaymentRegistry,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { type PaymentsEnv, writeSettings } from './payments-setup.service'

const MANUAL_ROW_FIELDS: Record<ManualRowId, readonly string[]> = {
  upi: ['upiId', 'payeeName'],
  bank: ['bankName', 'accountName', 'accountNumber', 'ifsc'],
}

/**
 * One row of "Manual payment methods" (audit #149): its details, its on/off and the note the
 * shopper reads. The built-in `manual` provider is at checkout while at least one row is on.
 */
export function saveManualPaymentMethod(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  env: Pick<PaymentsEnv, 'secret' | 'previousSecrets'>,
  input: {
    kind: ManualRowId
    on: boolean
    note: string
    fields: Record<string, string>
    /** Undefined keeps the saved one; null removes it. */
    adjustment?: PaymentAdjustment | null | undefined
  },
) {
  return writeSettings(tx, storeId, registry, env, (s) => {
    const manual = { ...(s.providers.manual ?? {}) }
    for (const k of MANUAL_ROW_FIELDS[input.kind]) {
      const v = input.fields[k]
      if (v === undefined) continue
      if (v.trim()) manual[k] = k === 'ifsc' ? v.trim().toUpperCase() : v.trim()
      else delete manual[k]
    }
    if (input.on && !manualRowReady(input.kind, manual)) {
      throw new ORPCError('BAD_REQUEST', {
        message:
          input.kind === 'upi'
            ? 'Enter your UPI ID and payee name first.'
            : 'Enter the bank, account holder, account number and IFSC first.',
      })
    }
    // The first save of a row fixes the other row's switch where it stood, so a row that was
    // never shown to shoppers does not start showing.
    const wasOn = s.enabled.includes('manual')
    const rows: Record<ManualRowId, ManualRow> = {
      upi: s.manualRows?.upi ?? { on: wasOn && manualRowOn(s.manualRows, 'upi') },
      bank: s.manualRows?.bank ?? { on: wasOn && manualRowOn(s.manualRows, 'bank') },
    }
    const note = input.note.trim()
    rows[input.kind] = note ? { on: input.on, note } : { on: input.on }
    const manualRows: ManualRows = { upi: rows.upi, bank: rows.bank }
    const live = anyManualRowLive(manual, manualRows)
    const enabled = live
      ? wasOn
        ? s.enabled
        : [...s.enabled, 'manual']
      : s.enabled.filter((x) => x !== 'manual')
    const adjustments = { ...s.adjustments }
    if (input.adjustment === null) delete adjustments.manual
    else if (input.adjustment) adjustments.manual = input.adjustment
    return {
      ...s,
      providers: { ...s.providers, manual },
      manualRows,
      enabled,
      adjustments,
    }
  })
}
