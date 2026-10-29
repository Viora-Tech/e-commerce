/** Country code added to a 10-digit mobile number; the platform is India-only today. */
const DEFAULT_CALLING_CODE = '91'
const NATIONAL_LENGTH = 10

/**
 * A stored phone as the international digits WhatsApp wants: spaces, dashes and a leading 0
 * (or "+91 0") dropped, +91 added to a 10-digit mobile. Null when it is too short to be a number.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '').replace(/^00/, '')
  const trunk = `${DEFAULT_CALLING_CODE}0`
  if (digits.length === NATIONAL_LENGTH + trunk.length && digits.startsWith(trunk)) {
    digits = digits.slice(trunk.length)
  }
  if (digits.length === NATIONAL_LENGTH + 1 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === NATIONAL_LENGTH) digits = `${DEFAULT_CALLING_CODE}${digits}`
  return digits.length > NATIONAL_LENGTH ? digits : null
}

/** `https://wa.me/<number>` for a stored phone, or null when it is too short to be a number. */
export function whatsappUrl(phone: string | null | undefined): string | null {
  const number = whatsappNumber(phone)
  return number ? `https://wa.me/${number}` : null
}

/** A wa.me chat with `text` typed in (just the chat when it is blank); null without a phone. */
export function whatsappChatUrl(phone: string | null | undefined, text: string): string | null {
  const base = whatsappUrl(phone)
  if (!base) return null
  return text.trim() ? `${base}?text=${encodeURIComponent(text)}` : base
}

/** A ten digit mobile as "79041 15879"; anything else comes back as it was. */
export function spacedMobile(phone: string): string {
  return /^\d{10}$/.test(phone) ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone
}

/** `tel:` link that keeps a leading plus and drops spaces and dashes. */
export function telUrl(phone: string | null | undefined): string | null {
  if (!phone) return null
  const dialable = phone.replace(/[^\d+]/g, '')
  return dialable ? `tel:${dialable}` : null
}
