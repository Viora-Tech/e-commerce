/** The store's WhatsApp chat link; null without a usable number. */
export function whatsAppHelp(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, '') ?? ''
  if (digits.length < 10) return null
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`
}
