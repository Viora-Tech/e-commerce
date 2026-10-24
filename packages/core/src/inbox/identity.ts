/** SOURCE OF TRUTH: newChatToken, hashChatToken, inboxHash — WHAT: the guest chat cookie (`wc_chat`, 32 random bytes) and the hashes Inbox stores instead of raw values (cookie, email, IP) / WHY: a database leak must never hand out a working chat cookie or a list of shopper IPs (design §5). Server only (node:crypto). */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import {
  encryptCustomerPhone,
  normalisePhoneDigits,
  phoneBlindIndex,
} from '../customers/phone-crypto'

export const CHAT_COOKIE = 'wc_chat'
/** One year, in seconds. */
export const CHAT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** A fresh guest chat token for the `wc_chat` cookie (base64url, 32 random bytes). */
export const newChatToken = (): string => randomBytes(32).toString('base64url')

/** What is stored for a chat token: sha256 hex. The token is random, so no key is needed. */
export function hashChatToken(token: string): string | null {
  const t = token.trim()
  if (t.length < 32 || t.length > 64) return null
  return createHash('sha256').update(t).digest('hex')
}

/**
 * Keyed hash of an email or an IP (both guessable, so a plain sha256 would not hide them).
 * Emails are lower-cased first so "A@x.co" and "a@x.co" block the same person.
 */
export function inboxHash(kind: 'email' | 'ip', value: string, secret: string): string {
  const v = kind === 'email' ? value.trim().toLowerCase() : value.trim()
  return createHmac('sha256', secret).update(`inbox:${kind}:${v}`).digest('hex')
}

/**
 * Blind index of a contact phone on its last 10 digits, so "+91 98765 43210" and "9876543210"
 * find the same conversation (Indian mobiles; the country code is the only prefix shoppers add).
 */
export const contactPhoneIndex = (phone: string, secret: string): string =>
  phoneBlindIndex(normalisePhoneDigits(phone).slice(-10), secret)

/** `{ cipher, index }` for `contact_phone` / `contact_phone_index`. */
export function encryptContactPhone(phone: string, secret: string) {
  return {
    cipher: encryptCustomerPhone(phone, secret).cipher,
    index: contactPhoneIndex(phone, secret),
  }
}
