/** SOURCE OF TRUTH: Meta customer-information hashing — WHAT: normalise then SHA-256 the email, phone, name, city, state, PIN and external id a server event carries / WHY: Meta only matches values normalised its way, and raw customer data must never leave unhashed */
import { createHash } from 'node:crypto'
import {
  type CustomerFacts,
  type MatchKey,
  type MatchValues,
  normaliseCustomerFacts,
} from './match'

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** Meta `user_data` keys that are hashed. Each is an array of one value, as Meta accepts. */
export type HashedUserData = Partial<Record<MatchKey, string[]>>

/** Normalise (`match.ts`) and hash what we know about a customer; unknown fields are left out. */
export function hashUserData(c: CustomerFacts): HashedUserData {
  const out: HashedUserData = {}
  for (const [key, value] of Object.entries(normaliseCustomerFacts(c)) as [MatchKey, string][]) {
    out[key] = [sha256(value)]
  }
  return out
}

/** The same values for the browser pixel: one SHA-256 hex string per key. */
export function hashMatchValues(c: CustomerFacts): MatchValues {
  const out: MatchValues = {}
  for (const [key, value] of Object.entries(normaliseCustomerFacts(c)) as [MatchKey, string][]) {
    out[key] = sha256(value)
  }
  return out
}
