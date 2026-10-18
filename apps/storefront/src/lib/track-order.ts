/**
 * The guest order lookup's matching rules, kept pure so they are tested on their own. A shopper
 * proves an order is theirs with its number and the email or mobile it was placed with; the
 * number alone never opens an order (numbers are sequential and easy to guess).
 */

/** "#1042", " 1042 " and "W1042" all read as 1042; anything without digits is no number. */
export function orderNumberFrom(input: string): number | null {
  const digits = input.replace(/\D/g, '')
  if (!digits || digits.length > 9) return null
  const n = Number(digits)
  return n > 0 ? n : null
}

/** The last ten digits of a phone number, so "+91 98765 43210" and "09876543210" match. */
const lastTen = (value: string) => value.replace(/\D/g, '').slice(-10)

/** Whether what the shopper typed is the email or the mobile on the order. */
export function contactMatches(
  typed: string,
  order: { email: string | null; phone: string | null },
): boolean {
  const value = typed.trim()
  if (!value) return false
  if (value.includes('@')) {
    return !!order.email && order.email.trim().toLowerCase() === value.toLowerCase()
  }
  const mobile = lastTen(value)
  return mobile.length === 10 && !!order.phone && lastTen(order.phone) === mobile
}
