import { z } from 'zod'

/** Indian GSTIN: 2-digit state code, PAN, entity number, Z, checksum. */
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export const StoreAddressSchema = z.object({
  line1: z.string().trim().max(200).default(''),
  line2: z.string().trim().max(200).default(''),
  city: z.string().trim().max(100).default(''),
  state: z.string().trim().max(100).default(''),
  pincode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[1-9][0-9]{5}$/.test(v), 'PIN code should be 6 digits')
    .default(''),
  country: z.string().trim().max(2).default('IN'),
})

export type StoreAddress = z.infer<typeof StoreAddressSchema>

export const emptyStoreAddress: StoreAddress = StoreAddressSchema.parse({})

/** Store details edited on Settings › General. Currency is read-only (INR) for now. */
export const StoreGeneralSchema = z.object({
  name: z.string().trim().min(1, 'Store name is required').max(120),
  contactEmail: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email')
    .default(''),
  contactPhone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?[0-9 -]{8,16}$/.test(v), 'Enter a valid phone number')
    .default(''),
  address: StoreAddressSchema.default(emptyStoreAddress),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || GSTIN.test(v), 'GSTIN should look like 06AAACW1234A1Z5')
    .default(''),
  timezone: z.string().trim().min(1).default('Asia/Kolkata'),
})

export type StoreGeneral = z.infer<typeof StoreGeneralSchema>

type StoreGeneralRow = {
  name: string
  currency: string
  contactEmail: string | null
  contactPhone: string | null
  address: unknown
  gstin: string | null
  timezone: string
}

/** Shape a store row for the General settings form; unknown address blobs fall back to empty. */
export function presentStoreGeneral(row: StoreGeneralRow): StoreGeneral & { currency: string } {
  const address = StoreAddressSchema.safeParse(row.address ?? {})
  return {
    name: row.name,
    currency: row.currency,
    contactEmail: row.contactEmail ?? '',
    contactPhone: row.contactPhone ?? '',
    address: address.success ? address.data : emptyStoreAddress,
    gstin: row.gstin ?? '',
    timezone: row.timezone,
  }
}
