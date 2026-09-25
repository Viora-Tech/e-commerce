/** SOURCE OF TRUTH: customer phone encryption — encrypts customer.phone at rest with an HMAC blind index for lookup */

/**
 * `customer.phone` is encrypted at rest (AES-256-GCM via `../secrets`, same
 * keyring as every other stored secret) because a phone number is directly
 * identifying PII, unlike the store-scoped provider config that module was
 * originally written for. Encryption alone loses equality search (the
 * customer list search box, dedupe on checkout), so every phone also carries
 * a deterministic HMAC-SHA256 "blind index" in `customer.phone_index`:
 * looking a phone up means hashing the query the same way and comparing
 * hashes, never decrypting rows to compare.
 *
 * Scope: only the `customer.phone` column. `address.phone` / `customer_address.phone`
 * (shipping labels, invoices, packing slips), `cart.phone` (abandoned-cart
 * recovery) and `default_address.phone` (the JSON snapshot on `customer`)
 * stay plaintext in this PR — see `docs/security/data-protection.md` for why.
 */
import { createHmac } from 'node:crypto'
import { decryptSecret, encryptSecret, isEncrypted } from '../secrets'

/** Digits only, so "+91 98765 43210", "9876543210" and "98765-43210" hash the same. */
export function normalisePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** Deterministic blind index for equality lookup on the encrypted column. Never decrypt to compare. */
export function phoneBlindIndex(phone: string, secret: string): string {
  return createHmac('sha256', secret).update(normalisePhoneDigits(phone)).digest('hex')
}

/** `{ cipher, index }` to store in `customer.phone` / `customer.phone_index`. */
export function encryptCustomerPhone(
  phone: string,
  secret: string,
): { cipher: string; index: string } {
  return { cipher: encryptSecret(phone, secret), index: phoneBlindIndex(phone, secret) }
}

/**
 * Decrypts a stored `customer.phone` value. Passes through unchanged when it
 * isn't an encrypted blob (not yet backfilled, or already plaintext in a
 * dev/test database with no key) and returns null rather than throwing when
 * the key doesn't match, matching how callers already treat a missing phone.
 */
export function decryptCustomerPhone(
  value: string | null | undefined,
  secret: string,
  previousSecrets: string[] = [],
): string | null {
  if (!value) return value ?? null
  if (!isEncrypted(value)) return value
  try {
    return decryptSecret(value, secret, previousSecrets)
  } catch {
    return null
  }
}
