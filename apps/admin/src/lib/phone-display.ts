/**
 * An Indian mobile number as people write it ("98046 82471"), the way the Figma tables show
 * phones. A +91 / 91 / 0 prefix is dropped when ten digits remain; anything else (another
 * country, a landline, a short code) is shown exactly as stored.
 */
export function phoneForDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const local =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits
  if (local.length !== 10 || !/^[6-9]/.test(local)) return raw
  return `${local.slice(0, 5)} ${local.slice(5)}`
}
