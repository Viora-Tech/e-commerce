import { formatPhone } from '@commerce/phone'

/**
 * The one way the admin shows a stored phone (#39): with its country code and the country's own
 * grouping, "+91 70218 67918", "+971 50 229 2692". A number without a code is read as Indian;
 * anything that does not parse is shown exactly as stored. Used by the customers list, the
 * customer page and the order's customer card.
 */
export function phoneForDisplay(raw: string): string {
  return formatPhone(raw)
}
