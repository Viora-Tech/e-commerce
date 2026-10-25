import { stateName } from '@/data/india'

type AddressLike = {
  name?: string | null
  line1: string
  line2?: string | null
  city: string
  stateCode: string
  pincode: string
  phone?: string | null
}

/** A postal address as display lines: name, street, city, "State PIN", phone (blanks dropped). */
export function addressLines(a: AddressLike): string[] {
  return [
    a.name,
    a.line1,
    a.line2,
    a.city,
    `${stateName(a.stateCode)} ${a.pincode}`,
    a.phone,
  ].filter((l): l is string => Boolean(l))
}
