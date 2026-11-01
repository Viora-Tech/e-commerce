import { stateName } from '@/data/india'

type AddressLike = {
  name?: string | null
  line1: string
  line2?: string | null
  city: string
  stateCode: string
  pincode: string
  /** ISO country; an address outside India shows its country's name. */
  country?: string | null
  phone?: string | null
}

/** A country's English name (`AE` → United Arab Emirates). */
const countryName = (code: string): string =>
  new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code

/**
 * A postal address as display lines: name, street, city, "State PIN", the country when it is not
 * India, phone (blanks dropped).
 */
export function addressLines(a: AddressLike): string[] {
  return [
    a.name,
    a.line1,
    a.line2,
    a.city,
    `${stateName(a.stateCode)} ${a.pincode}`.trim(),
    a.country && a.country !== 'IN' ? countryName(a.country) : null,
    a.phone,
  ].filter((l): l is string => Boolean(l))
}
