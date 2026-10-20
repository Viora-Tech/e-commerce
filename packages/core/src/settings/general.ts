import { isMoneyFormat, MONEY_FORMAT_MAX } from '@commerce/money'
import { z } from 'zod'
import { isValidPhone, normalisePhone } from '../accounts/phone'
import { GstinSchema } from '../tax/settings'

/** Most gaming and electronics accessories sit at 18%; merchants can change it. */
export const DEFAULT_GST_RATE_PERCENT = 18

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

const MONEY_FORMAT_ERROR = 'Include {{amount}} or {{amount_no_decimals}}, e.g. Rs. {{amount}}'

/** Store details edited on Settings › General. Currency is read-only (INR) for now. */
export const StoreGeneralSchema = z.object({
  name: z.string().trim().min(1, 'Store name is required').max(120),
  contactEmail: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || z.string().email().safeParse(v).success,
      'Enter an email like name@example.com',
    )
    .default(''),
  contactPhone: z
    .string()
    .trim()
    .refine((v) => v === '' || isValidPhone(v), 'Enter a valid phone number')
    .transform((v) => (v === '' ? '' : (normalisePhone(v) ?? v)))
    .default(''),
  address: StoreAddressSchema.default(emptyStoreAddress),
  gstin: GstinSchema.default(''),
  timezone: z.string().trim().min(1).default('Asia/Kolkata'),
  /** GST rate contained in listed prices; 0 turns the tax line off. */
  gstRatePercent: z.coerce.number().min(0).max(40).default(DEFAULT_GST_RATE_PERCENT),
  /**
   * How prices read on the storefront, Shopify-style (`Rs. {{amount}}`); blank is the
   * currency's own format (₹6,499). The Shopify import brings the shop's over.
   */
  moneyFormat: z
    .string()
    .trim()
    .max(MONEY_FORMAT_MAX)
    .refine((v) => v === '' || (isMoneyFormat(v) && !/[<>]/.test(v)), MONEY_FORMAT_ERROR)
    .default(''),
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
  gstRatePercent?: number | null
  moneyFormat?: string | null
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
    gstRatePercent: row.gstRatePercent ?? DEFAULT_GST_RATE_PERCENT,
    moneyFormat: row.moneyFormat ?? '',
  }
}
