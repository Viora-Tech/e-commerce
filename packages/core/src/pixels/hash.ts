/** SOURCE OF TRUTH: Meta customer-information hashing — WHAT: normalise then SHA-256 the email, phone, name, city, state, PIN and external id a server event carries / WHY: Meta only matches values normalised its way, and raw customer data must never leave unhashed */
import { createHash } from 'node:crypto'
import { normalisePhone } from '../marketing/audience'
import { stateCode } from '../tax/states'

/*
 * Rules from Meta's "customer information parameters" (Conversions API), with Indian defaults:
 * a 10-digit mobile gets 91, a leading 0 is dropped, states are the two-letter code (`mh`),
 * PINs are six digits and the country is `in`. Each normaliser returns null for a value that
 * would not match anything, so it is left out rather than hashed as junk.
 */

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function normaliseEmail(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null
}

/** Digits with the country code, no `+` (`919876543210`). */
export function normaliseMetaPhone(raw: string | null | undefined): string | null {
  return normalisePhone(raw)
}

/**
 * First or last name: lowercase, punctuation and spaces removed, letters in any script kept
 * (`Rāhul`, `राहुल`). Combining marks stay, so Devanagari vowel signs survive.
 */
export function normaliseName(raw: string | null | undefined): string | null {
  const v = (raw ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]/gu, '')
  return v || null
}

/** City: lowercase, no spaces or punctuation (`navimumbai`). */
export function normaliseCity(raw: string | null | undefined): string | null {
  return normaliseName(raw)
}

/** State: the lowercase two-letter Indian code, from a code or a full name; null if unknown. */
export function normaliseState(raw: string | null | undefined): string | null {
  return stateCode(raw)?.toLowerCase() ?? null
}

/** PIN code: exactly six digits. */
export function normalisePin(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/\s/g, '')
  return /^[1-9]\d{5}$/.test(v) ? v : null
}

/** Split "Asha K. Rao" into first and last name the way Meta expects them. */
export function splitName(full: string | null | undefined): {
  first: string | null
  last: string | null
} {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: null, last: null }
  if (parts.length === 1) return { first: parts[0] ?? null, last: null }
  return { first: parts[0] ?? null, last: parts[parts.length - 1] ?? null }
}

export type CustomerFacts = {
  email?: string | null | undefined
  phone?: string | null | undefined
  name?: string | null | undefined
  city?: string | null | undefined
  state?: string | null | undefined
  pincode?: string | null | undefined
  /** The customer id, else the visitor id: hashed into `external_id`. */
  externalId?: string | null | undefined
}

/** Meta `user_data` keys that are hashed. Each is an array of one value, as Meta accepts. */
export type HashedUserData = Partial<
  Record<'em' | 'ph' | 'fn' | 'ln' | 'ct' | 'st' | 'zp' | 'country' | 'external_id', string[]>
>

/** Normalise and hash what we know about a customer; unknown fields are left out. */
export function hashUserData(c: CustomerFacts): HashedUserData {
  const { first, last } = splitName(c.name)
  const fields: [keyof HashedUserData, string | null][] = [
    ['em', normaliseEmail(c.email)],
    ['ph', normaliseMetaPhone(c.phone)],
    ['fn', normaliseName(first)],
    ['ln', normaliseName(last)],
    ['ct', normaliseCity(c.city)],
    ['st', normaliseState(c.state)],
    ['zp', normalisePin(c.pincode)],
    ['country', 'in'],
    ['external_id', c.externalId?.trim() || null],
  ]
  const out: HashedUserData = {}
  for (const [key, value] of fields) if (value) out[key] = [sha256(value)]
  return out
}
