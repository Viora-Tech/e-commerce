/**
 * Pure mapping helpers for the ShipGlobal adapter: weights, names, street lines, transit text
 * and tracking event codes, as ShipGlobal's vendor API spells them
 * (https://developer.docs.shipglobal.in/).
 */

import { type ShipmentAddress, type ShipmentStatus, wrapAddressLines } from '@commerce/shipping'
import {
  SHIPGLOBAL_DEFAULT_SERVICE,
  SHIPGLOBAL_SERVICES,
  type ShipglobalServiceCode,
} from './client'

/** VERIFY: ShipGlobal's per-line limit for address lines; 50 is a safe guess. */
const ADDRESS_LINE_MAX = 50

export const SERVICE_CODES = new Set<string>(SHIPGLOBAL_SERVICES.map((s) => s.code))

/** A saved service, or the default for anything else (the old Label API's codes included). */
export function serviceOrDefault(raw: string | undefined): ShipglobalServiceCode {
  const v = raw?.trim() ?? ''
  const hit = SHIPGLOBAL_SERVICES.find((s) => s.code.toLowerCase() === v.toLowerCase())
  return hit?.code ?? SHIPGLOBAL_DEFAULT_SERVICE
}

/** Grams to the kg string the docs send ("0.02", ".5"): up to three decimals, no trailing zeros. */
export const kg = (grams: number) => String(Math.max(Math.round(grams), 1) / 1000)

export const cm = (n: number) => String(Math.max(Math.ceil(n), 1))

export const rupees = (paise: number) => String(Math.round(paise) / 100)

/** "Asha Verma" → Asha / Verma. One word fills both, so neither name goes empty. */
export function splitName(name: string): { first: string; last: string } {
  const [first = name, ...rest] = name.trim().split(/\s+/)
  return { first, last: rest.join(' ') || first }
}

/** As typed, digits kept with a leading + (the docs' sample is "+1-999-999-9999"). */
export function phoneOf(raw: string): string {
  const t = raw.trim()
  return t.startsWith('+') ? `+${t.replace(/\D/g, '')}` : t
}

/** The three street lines. The second falls back to the city, so it is never empty. */
export function streetLines(a: ShipmentAddress): [string, string, string] {
  const [one = a.city, two, three] = wrapAddressLines([a.line1, a.line2], ADDRESS_LINE_MAX, 3)
  return [one, two ?? a.city, three ?? '']
}

/** "7-10 Days", "4 - 7 Days", "5 Days" → day range; nulls when the text has no number. */
export function transitDays(text: string | undefined): { min: number | null; max: number | null } {
  const nums = (text ?? '').match(/\d+/g)?.map(Number) ?? []
  if (!nums.length) return { min: null, max: null }
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

/** Billed weight to grams: the docs answer "GM"; KG is read too. Null when it does not say. */
export function billedGrams(weight: number | undefined, unit: string | undefined): number | null {
  if (typeof weight !== 'number' || !Number.isFinite(weight)) return null
  return unit?.trim().toUpperCase() === 'KG' ? Math.round(weight * 1000) : Math.round(weight)
}

/** The carrier behind a service title, for the rate table; null for ShipGlobal's own. */
export function carrierOf(title: string): string | null {
  if (/^ups\b/i.test(title)) return 'UPS'
  if (/^fedex\b/i.test(title)) return 'FedEx'
  if (/^dhl\b/i.test(title)) return 'DHL'
  return null
}

/**
 * The docs' event codes (Tracking, "Event codes") to our statuses. Exceptions (4xx, 503,
 * 505, 506, SGERROR_*) stay in transit: the parcel is still out there and its comment says why.
 */
export function statusOfEvent(code: string | undefined): ShipmentStatus {
  const c = (code ?? '').trim().toUpperCase()
  if (c === 'SGE_304') return 'delivered'
  if (c === 'SGE_303' || c === 'SGE_501') return 'out_for_delivery'
  if (c === 'SGE_502' || c === 'SGE_504') return 'rto'
  if (c === 'SGE_104') return 'picked_up'
  if (/^SGE_00\d$/.test(c) || /^SGE_10[1-3]$/.test(c)) return 'created'
  return 'in_transit'
}

/**
 * "2023-10-03 10:46:11", no zone. VERIFY: read as India time, like the rest of ShipGlobal's
 * panel; a scan abroad may be in local time, which moves it a few hours at most.
 */
export function eventInstant(raw: string | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/.exec(raw?.trim() ?? '')
  if (!m) return null
  const time = m[2]?.length === 5 ? `${m[2]}:00` : m[2]
  const at = new Date(`${m[1]}T${time}+05:30`)
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}
