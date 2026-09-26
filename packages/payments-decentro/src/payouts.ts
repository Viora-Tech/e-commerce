/**
 * Refunds sent as a UPI payout from the merchant's funded Decentro account.
 * Official docs:
 * - Initiate Payout v3: https://docs.decentro.tech/reference/payments_api-initiate-payout-v3
 * - Get Transaction Status v3: https://docs.decentro.tech/reference/payments_api-get-transaction-status-v3
 * - Status values (success / failure / pending / unknown): https://docs.decentro.tech/reference/payments_api-payouts-v3
 */

import type { PayoutRefundInput, PayoutRefundResult } from '@commerce/payments'
import {
  DecentroApiError,
  type DecentroCredentials,
  decentroRequest,
  narration,
  rupees,
} from './client'

/** Payout `reference_id`: alphanumeric only (no hyphens), per the Initiate Payout spec. */
export const payoutReferenceId = (refundKey: string): string =>
  refundKey.replace(/[^A-Za-z0-9]/g, '').slice(0, 64) || 'refund'

/** `payee_name`: alphabets only, at most 40 characters. */
const payeeNameOf = (name: string): string =>
  name
    .replace(/[^A-Za-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40) || 'Customer'

/** NPCI-shaped UPI ID: `handle@bank`. */
const UPI_ID = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.]{1,64}$/

type PayoutData = {
  transaction_status?: string
  transfer_type?: string
  bank_reference_number?: string
  transaction_status_description?: string
}

/** Decentro payout status (any case) to ours; `failure` means the money came back. */
export function payoutStatusOf(status: string | undefined): 'processed' | 'pending' | 'failed' {
  const s = (status ?? '').toLowerCase()
  if (s === 'success') return 'processed'
  if (s === 'failure') return 'failed'
  return 'pending'
}

export async function initiateUpiPayout(
  fetchImpl: typeof fetch,
  creds: DecentroCredentials,
  consumerUrn: string,
  input: PayoutRefundInput,
): Promise<PayoutRefundResult> {
  if (!UPI_ID.test(input.toUpi)) throw new Error('That UPI ID does not look right.')
  if (input.amountPaise < 100) throw new Error('Decentro payouts start at ₹1.')
  const referenceId = payoutReferenceId(input.refundKey)
  let res: Awaited<ReturnType<typeof decentroRequest<PayoutData>>>
  try {
    res = await decentroRequest<PayoutData>(
      fetchImpl,
      creds,
      'payouts',
      'POST',
      '/v3/core_banking/money_transfer/initiate',
      {
        reference_id: referenceId,
        purpose_message: narration(input.note ?? 'Order refund', 35, 'Order refund', 5),
        consumer_urn: consumerUrn,
        transfer_type: 'UPI',
        transfer_amount: rupees(input.amountPaise),
        beneficiary_details: { payee_name: payeeNameOf(input.payeeName), to_upi: input.toUpi },
      },
    )
  } catch (err) {
    // Same refund key twice: Decentro refuses the reference, so report the first payout instead.
    if (err instanceof DecentroApiError && err.responseKey?.includes('duplicate')) {
      return fetchPayoutStatus(fetchImpl, creds, { referenceId })
    }
    throw err
  }
  const status = payoutStatusOf(res.data?.transaction_status)
  if (status === 'failed') {
    throw new Error(
      res.data?.transaction_status_description ?? 'Decentro could not send the payout.',
    )
  }
  return { providerRefundId: res.decentro_txn_id ?? referenceId, status }
}

/** A payout's state, by Decentro's id or our reference. A failed payout throws. */
export async function fetchPayoutStatus(
  fetchImpl: typeof fetch,
  creds: DecentroCredentials,
  ref: { decentroTxnId: string } | { referenceId: string },
): Promise<PayoutRefundResult> {
  const query =
    'decentroTxnId' in ref
      ? `decentro_txn_id=${encodeURIComponent(ref.decentroTxnId)}`
      : `reference_id=${encodeURIComponent(ref.referenceId)}`
  const res = await decentroRequest<PayoutData>(
    fetchImpl,
    creds,
    'payouts',
    'GET',
    `/v3/core_banking/money_transfer/get_status?${query}`,
  )
  const status = payoutStatusOf(res.data?.transaction_status)
  if (status === 'failed') {
    throw new Error(
      res.data?.transaction_status_description ?? 'Decentro could not send the payout.',
    )
  }
  // The status reply's own `decentro_txn_id` may be the lookup's id, so keep the one we asked by.
  const id = 'decentroTxnId' in ref ? ref.decentroTxnId : ref.referenceId
  return { providerRefundId: id, status }
}
