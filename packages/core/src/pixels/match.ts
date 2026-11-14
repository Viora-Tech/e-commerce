/** SOURCE OF TRUTH: Meta customer-information normalising — WHAT: the email, phone, name, city, state, PIN, country and external id rules Meta matches on, shared by the server Conversions API (`hash.ts`) and the browser pixel's manual advanced matching / WHY: both copies of an event must normalise a shopper the same way, or Meta matches one and not the other; pure (no node:crypto) so the storefront's browser code can use it */
import { stateCode } from '../tax/states'

/*
 * Rules from Meta's "customer information parameters", with Indian defaults: a 10-digit mobile
 * gets 91, a leading 0 is dropped, states are the two-letter code (`mh`), PINs are six digits
 * and the country is `in` unless the address says otherwise. Each normaliser returns null for a
 * value that would not match anything, so it is left out rather than hashed as junk.
 */

export function normaliseEmail(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null
}

/** Digits with the country code, no `+` (`919876543210`). Same rules as `marketing/audience`. */
export function normaliseMetaPhone(raw: string | null | undefined): string | null {
  const digits = raw?.replace(/\D/g, '') ?? ''
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return digits.length >= 11 && digits.length <= 15 ? digits : null
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

/** Country: the lowercase ISO 3166-1 alpha-2 code (`in`, `ae`); null if not one. */
export function normaliseCountry(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ''
  return /^[a-z]{2}$/.test(v) ? v : null
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
  /** ISO 3166-1 alpha-2; India when unknown. */
  country?: string | null | undefined
  /** The customer id, else the visitor id: hashed into `external_id`. */
  externalId?: string | null | undefined
}

/** Meta's customer-information keys we send, in Meta's names. */
const MATCH_KEYS = ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country', 'external_id'] as const

export type MatchKey = (typeof MATCH_KEYS)[number]

/** One value per key: normalised plain text before hashing, SHA-256 hex after. */
export type MatchValues = Partial<Record<MatchKey, string>>

/**
 * What we know about a shopper, normalised Meta's way; unknown fields are left out. The
 * country falls back to India (the store's market) so the server event always carries one.
 */
export function normaliseCustomerFacts(c: CustomerFacts): MatchValues {
  const { first, last } = splitName(c.name)
  const country = normaliseCountry(c.country) ?? 'in'
  const fields: [MatchKey, string | null][] = [
    ['em', normaliseEmail(c.email)],
    ['ph', normaliseMetaPhone(c.phone)],
    ['fn', normaliseName(first)],
    ['ln', normaliseName(last)],
    ['ct', normaliseCity(c.city)],
    // Meta's state rule is the two-letter code; we only know India's, and PINs are India's.
    ['st', country === 'in' ? normaliseState(c.state) : null],
    ['zp', country === 'in' ? normalisePin(c.pincode) : null],
    ['country', country],
    ['external_id', c.externalId?.trim() || null],
  ]
  const out: MatchValues = {}
  for (const [key, value] of fields) if (value) out[key] = value
  return out
}

const SHA256_HEX = /^[0-9a-f]{64}$/

/** True for a SHA-256 hex digest: the only shape a browser match value may take. */
function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX.test(value)
}

/**
 * The hashed match values the browser pixel may be given: known keys with SHA-256 hex values
 * only, so nothing readable is ever handed to fbevents.js. Null when there is nothing but the
 * default country (it matches nobody on its own).
 */
export function browserMatchData(raw: unknown): MatchValues | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const out: MatchValues = {}
  for (const key of MATCH_KEYS) {
    const v = r[key]
    if (isSha256Hex(v)) out[key] = v
  }
  const keys = Object.keys(out)
  return keys.length === 0 || (keys.length === 1 && out.country) ? null : out
}
