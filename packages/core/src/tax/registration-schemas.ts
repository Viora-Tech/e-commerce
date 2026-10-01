/** SOURCE OF TRUTH: BusinessInputSchema, RegistrationInputSchema, PanSchema, InvoicePrefixSchema, GST_REGISTRATION_ERROR_CODES — WHAT the boundary shapes of Settings › Business and GST and the codes its refusals carry / WHY the admin dialogs and the router validate with the same schemas, and the client narrows on a code, never on message text. Pure, no database: `@commerce/core/gst-registrations`. Rules live in ./registrations.ts. */
import { z } from 'zod'
import { GstinSchema } from './settings'

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/

/** A PAN: five letters, four digits, one letter. */
export const PanSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => PAN.test(v), 'PAN should look like ABCDE1234F')

/** A GST number that must be filled in (the Taxes page's field may be blank). */
export const RequiredGstinSchema = GstinSchema.refine((v) => v !== '', 'Enter the GST number')

/** Printed before invoice numbers from this GSTIN: up to 5 letters or digits. */
export const InvoicePrefixSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => /^[A-Z0-9]{0,5}$/.test(v), 'Use up to 5 letters or numbers')

/** Principal place of business in the GSTIN's state; the state itself comes from the GSTIN. */
export const LegalAddressSchema = z.object({
  line1: z.string().trim().max(200).default(''),
  line2: z.string().trim().max(200).default(''),
  city: z.string().trim().max(100).default(''),
  pincode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[1-9][0-9]{5}$/.test(v), 'PIN code should be 6 digits')
    .default(''),
})
export type LegalAddress = z.infer<typeof LegalAddressSchema>

export const BusinessInputSchema = z.object({
  legalName: z.string().trim().min(1, 'Enter the name on the PAN card').max(160),
  tradeName: z.string().trim().max(160).default(''),
  pan: PanSchema,
})
export type BusinessInput = z.input<typeof BusinessInputSchema>

export const BusinessUpdateSchema = BusinessInputSchema.extend({ id: z.uuid() })
export type BusinessUpdate = z.input<typeof BusinessUpdateSchema>

const RegistrationFields = {
  registrationType: z.enum(['regular', 'composition']).default('regular'),
  legalAddress: LegalAddressSchema.prefault({}),
  tradeName: z.string().trim().max(160).default(''),
  email: z.union([z.literal(''), z.email('Enter a valid email')]).default(''),
  phone: z.string().trim().max(20).default(''),
  invoicePrefix: InvoicePrefixSchema.default(''),
  /** yyyy-mm-dd from the registration certificate; blank when not known. */
  effectiveFrom: z.union([z.literal(''), z.iso.date()]).default(''),
}

export const RegistrationInputSchema = z.object({
  gstin: RequiredGstinSchema,
  /** The business this GSTIN belongs to; omitted means the store's main business. */
  businessId: z.uuid().optional(),
  /** Used only when the store has no business yet: the main business is created with it. */
  legalName: z.string().trim().max(160).default(''),
  makeDefault: z.boolean().default(false),
  ...RegistrationFields,
})
export type RegistrationInput = z.input<typeof RegistrationInputSchema>

/** The GSTIN itself never changes; a new number is a new registration. */
export const RegistrationUpdateSchema = z.object({ id: z.uuid(), ...RegistrationFields })
export type RegistrationUpdate = z.input<typeof RegistrationUpdateSchema>

export const RegistrationIdSchema = z.object({ id: z.uuid() })

export const LocationRegistrationSchema = z.object({
  locationId: z.uuid(),
  /** Null: not chosen. */
  gstRegistrationId: z.uuid().nullable(),
})
export type LocationRegistration = z.infer<typeof LocationRegistrationSchema>

/** Why a Business and GST change was refused. The admin narrows on these, never on text. */
export const GST_REGISTRATION_ERROR_CODES = [
  'NOT_FOUND',
  'INVALID_GSTIN',
  'PAN_MISMATCH',
  'DUPLICATE_GSTIN',
  'DUPLICATE_PAN',
  'PAN_LOCKED',
  'CANCELLED',
  'STATE_MISMATCH',
  'MANAGED_ELSEWHERE',
] as const
export type GstRegistrationErrorCode = (typeof GST_REGISTRATION_ERROR_CODES)[number]
