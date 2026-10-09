/** Country code added to a 10-digit mobile number; the platform is India-only today. */
const DEFAULT_CALLING_CODE = '91'
const NATIONAL_LENGTH = 10

/** `https://wa.me/<number>` for a stored phone, or null when it is too short to be a number. */
export function whatsappUrl(phone: string | null | undefined): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (digits.length === NATIONAL_LENGTH + 1 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === NATIONAL_LENGTH) digits = `${DEFAULT_CALLING_CODE}${digits}`
  return digits.length > NATIONAL_LENGTH ? `https://wa.me/${digits}` : null
}

/** `tel:` link that keeps a leading plus and drops spaces and dashes. */
export function telUrl(phone: string | null | undefined): string | null {
  if (!phone) return null
  const dialable = phone.replace(/[^\d+]/g, '')
  return dialable ? `tel:${dialable}` : null
}
