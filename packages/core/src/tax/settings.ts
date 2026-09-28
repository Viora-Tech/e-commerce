/** SOURCE OF TRUTH: store tax settings — WHAT the Taxes & GST form schema, the composition and prices-include-GST switches kept in store.apps.settings.core.tax, and the GSTIN state lookup / WHY checkout, invoices and the settings page must agree on whether and how GST is charged. No database. */
import { z } from 'zod'
import {
  type AppsSettings,
  appSettingsOf,
  parseAppsSettings,
  withAppSettings,
} from '../apps/settings'
import { gstinState, validateGstin } from './gstin'
import { INDIAN_STATE_NAMES } from './states'

/**
 * Settings › Taxes & GST. Pure: safe for client components
 * (`@commerce/core/tax-settings`).
 *
 * Where each field lives, so nothing is stored twice:
 * - GSTIN and the default rate: the `store.gstin` and `store.gst_rate_percent` columns.
 * - Legal name, registered address, default HSN and invoice numbering: the GST invoices
 *   app's settings row (its `seller`, `defaultHsn` and domestic tax-invoice series).
 * - The two switches below: `store.apps.settings.core.tax`, beside the per-app entries
 *   (the core plugin's own slot), so no migration is needed.
 */

/** GST slabs a merchant picks from. Integers: the store and variant columns are whole percents. */
export const GST_RATE_OPTIONS = [0, 3, 5, 12, 18, 28, 40] as const

/** Rule 5(1)(g) of the CGST Rules: the words a composition dealer prints on every bill. */
export const COMPOSITION_NOTE =
  'Composition taxable person, not eligible to collect tax on supplies'

const HSN = /^[0-9]{4}([0-9]{2}){0,2}$/

export const StoreTaxSettingsSchema = z.object({
  /** Listed prices already contain GST (the Indian retail norm). */
  pricesIncludeGst: z.boolean().default(true),
  /** Composition scheme (CGST Act s.10): no GST is charged, bills carry {@link COMPOSITION_NOTE}. */
  composition: z.boolean().default(false),
})
export type StoreTaxSettings = z.infer<typeof StoreTaxSettingsSchema>

export const defaultStoreTaxSettings: StoreTaxSettings = StoreTaxSettingsSchema.parse({})

/** The core plugin's id; its `store.apps.settings` entry holds core switches such as `tax`. */
const CORE_KEY = 'core'

const CoreEntrySchema = z.object({ tax: z.unknown().optional() }).catchall(z.unknown())

/** Tax switches from a raw `store.apps` blob; anything missing or broken reads as the defaults. */
export function parseStoreTax(appsRaw: unknown): StoreTaxSettings {
  const entry = CoreEntrySchema.safeParse(appSettingsOf(parseAppsSettings(appsRaw), CORE_KEY))
  const tax = StoreTaxSettingsSchema.safeParse(entry.success ? (entry.data.tax ?? {}) : {})
  return tax.success ? tax.data : defaultStoreTaxSettings
}

/** `store.apps` with the tax switches replaced; installed apps and every other entry are kept. */
export function withStoreTax(appsRaw: unknown, tax: StoreTaxSettings): AppsSettings {
  const apps = parseAppsSettings(appsRaw)
  const entry = CoreEntrySchema.safeParse(appSettingsOf(apps, CORE_KEY))
  return withAppSettings(apps, CORE_KEY, { ...(entry.success ? entry.data : {}), tax })
}

/** The GST rate actually charged: nothing at all under the composition scheme. */
export function chargedGstRate(ratePercent: number, tax: Pick<StoreTaxSettings, 'composition'>) {
  return tax.composition ? 0 : Math.max(0, ratePercent)
}

/** A GSTIN field: blank, or 15 characters that pass the shape, state and checksum tests. */
export const GstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .superRefine((v, ctx) => {
    if (v === '') return
    const check = validateGstin(v)
    if (check.ok) return
    ctx.addIssue({
      code: 'custom',
      message:
        check.reason === 'checksum'
          ? 'This GSTIN has a typo: its last character does not match the rest'
          : check.reason === 'state'
            ? 'The first two digits are not a GST state code'
            : 'GSTIN should look like 06AAACW1234A1Z5',
    })
  })

/** Where a GSTIN is registered, from its first two digits: `{ code: 'HR', name: 'Haryana' }`. */
export function gstinStateOf(gstin: string): { code: string; name: string } | null {
  const v = gstin.trim().toUpperCase()
  if (!/^[0-9]{2}/.test(v)) return null
  const code = gstinState(v)
  const name = code ? INDIAN_STATE_NAMES[code] : undefined
  return code && name ? { code, name } : null
}

/** Everything on the Taxes & GST page except invoice numbering (validated by the invoices package). */
export const TaxesFormSchema = z.object({
  gstin: GstinSchema.default(''),
  legalName: z.string().trim().max(160).default(''),
  address: z
    .object({
      line1: z.string().trim().max(200).default(''),
      line2: z.string().trim().max(200).default(''),
      city: z.string().trim().max(100).default(''),
      pincode: z
        .string()
        .trim()
        .refine((v) => v === '' || /^[1-9][0-9]{5}$/.test(v), 'PIN code should be 6 digits')
        .default(''),
    })
    .prefault({}),
  gstRatePercent: z.coerce.number().int('Pick a whole percent').min(0).max(40).default(18),
  defaultHsn: z
    .string()
    .trim()
    .refine((v) => v === '' || HSN.test(v), 'HSN codes are 4, 6 or 8 digits')
    .default(''),
  pricesIncludeGst: z.boolean().default(true),
  composition: z.boolean().default(false),
})
export type TaxesForm = z.infer<typeof TaxesFormSchema>
