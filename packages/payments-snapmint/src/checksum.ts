/**
 * SOURCE OF TRUTH KEYWORDS: snapmintChecksum, verifySnapmintChecksum, checksum_hash
 * WHAT:  Snapmint's checksum on the shopper's return post and on the S2S webhook: SHA-512 (hex)
 *        of `merchant_token|status|order_id|order_value|full_name|email|merchant_key`
 *        (integration document v20250722, section 7 "Confirming Checksum Response"; `status`
 *        exactly as received). Compared in constant time.
 * WHY:   The checksum is the only thing that proves a post came from Snapmint: both keys are in
 *        it and neither is ever sent to the browser.
 * WHERE: SnapmintProvider.parseWebhook and parseReturn (snapmint.ts).
 */
import { createHash } from 'node:crypto'
import { safeEqual } from '@commerce/payments'

export type ChecksumKeys = { merchantToken: string; merchantKey: string }

/** The fields the checksum covers, as Snapmint posts them (null and missing read as ''). */
export type ChecksumFields = {
  status?: unknown
  order_id?: unknown
  order_value?: unknown
  full_name?: unknown
  email?: unknown
  checksum_hash?: unknown
}

const text = (v: unknown): string =>
  v === null || v === undefined ? '' : typeof v === 'string' ? v : String(v)

export function snapmintChecksum(
  keys: ChecksumKeys,
  f: { status: string; orderId: string; orderValue: string; fullName: string; email: string },
): string {
  const raw = [
    keys.merchantToken,
    f.status,
    f.orderId,
    f.orderValue,
    f.fullName,
    f.email,
    keys.merchantKey,
  ].join('|')
  return createHash('sha512').update(raw, 'utf8').digest('hex')
}

/**
 * The ways one order value may have been written when Snapmint hashed it. UNVERIFIED: the
 * document shows `"order_value": 10000` in JSON, so a JSON number loses how Snapmint wrote it
 * (`10000`, `10000.0`, `10000.00`); each spelling is tried. All of them still need both keys.
 */
export function orderValueSpellings(v: unknown): string[] {
  const out = new Set<string>([text(v)])
  const n = typeof v === 'number' ? v : Number(text(v))
  if (text(v) !== '' && Number.isFinite(n)) {
    out.add(String(n))
    out.add(n.toFixed(1))
    out.add(n.toFixed(2))
    if (Number.isInteger(n)) out.add(String(Math.trunc(n)))
  }
  return [...out]
}

/** True when `checksum_hash` matches the other fields under these keys. */
export function verifySnapmintChecksum(keys: ChecksumKeys, fields: ChecksumFields): boolean {
  const given = text(fields.checksum_hash).trim().toLowerCase()
  if (!/^[0-9a-f]{128}$/.test(given)) return false
  if (!keys.merchantToken || !keys.merchantKey) return false
  let ok = false
  for (const orderValue of orderValueSpellings(fields.order_value)) {
    const expected = snapmintChecksum(keys, {
      status: text(fields.status),
      orderId: text(fields.order_id),
      orderValue,
      fullName: text(fields.full_name),
      email: text(fields.email),
    })
    // Every spelling is compared, so the time taken does not say which one matched.
    if (safeEqual(expected, given)) ok = true
  }
  return ok
}
