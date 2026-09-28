/** SOURCE OF TRUTH: store policies, grievance officer, business legal name — WHAT: the five policy kinds (their page handles, storefront paths and which are required), the legal name and grievance officer stored on `store.preferences.policies`, and the helpers the footer, checkout, theme editor and a later customer-privacy page read / WHY: Settings → Policies, the storefront and the setup checklist must agree on which policies exist and where they live, and client code needs this without a database import */
import { z } from 'zod'

/*
 * Pure: no database import, so admin and storefront client components can use
 * it through `@commerce/core/policies`.
 *
 * A policy is an ordinary online-store page (`page` table) with a fixed
 * handle. The handles are Shopify's, so a store imported from Shopify keeps
 * its policy URLs and its imported policy pages are picked up as they are.
 */

export const POLICY_TYPES = [
  'refund-policy',
  'privacy-policy',
  'terms-of-service',
  'shipping-policy',
  'contact-information',
] as const
export type PolicyType = (typeof POLICY_TYPES)[number]

/** Page title a policy gets when it is created. The merchant can rename it. */
export const POLICY_TITLES: Record<PolicyType, string> = {
  'refund-policy': 'Refund and returns policy',
  'privacy-policy': 'Privacy policy',
  'terms-of-service': 'Terms of service',
  'shipping-policy': 'Shipping policy',
  'contact-information': 'Contact information',
}

/**
 * Policies every Indian online store should publish. The Consumer Protection
 * (E-Commerce) Rules, 2020 ask for return, refund, delivery and seller contact
 * details; the DPDP Act, 2023 asks for a privacy notice; terms set the contract.
 */
export const REQUIRED_POLICY_TYPES: readonly PolicyType[] = POLICY_TYPES

export function isPolicyType(value: unknown): value is PolicyType {
  return typeof value === 'string' && (POLICY_TYPES as readonly string[]).includes(value)
}

/** Storefront path of a published policy. */
export const policyPath = (type: PolicyType): string => `/policies/${type}`

/** Handle of the page that holds a policy. Same string as the type, kept as a function so that can change. */
export const policyHandle = (type: PolicyType): string => type

/** The policy a page handle belongs to, or null for an ordinary page. */
export function policyTypeOfHandle(handle: string): PolicyType | null {
  return isPolicyType(handle) ? handle : null
}

const PHONE = /^\+?[0-9 -]{8,16}$/

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email')
  .default('')

const optionalPhone = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === '' || PHONE.test(v), 'Enter a valid phone number')
  .default('')

/**
 * The person shoppers can complain to. The Consumer Protection (E-Commerce)
 * Rules, 2020 ask every online seller to name one with their contact details,
 * and the DPDP Act, 2023 asks for a contact who answers questions about
 * personal data. The privacy policy and the storefront footer show it.
 */
export const GrievanceOfficerSchema = z.object({
  name: z.string().trim().max(120).default(''),
  designation: z.string().trim().max(120).default(''),
  email: optionalEmail,
  phone: optionalPhone,
})
export type GrievanceOfficer = z.infer<typeof GrievanceOfficerSchema>

export const PolicySettingsSchema = z.object({
  /** Registered business name, when it differs from the store name (e.g. "Waimers Tech Pvt Ltd"). */
  legalName: z.string().trim().max(200).default(''),
  grievanceOfficer: GrievanceOfficerSchema.prefault({}),
})
export type PolicySettings = z.infer<typeof PolicySettingsSchema>

export const defaultPolicySettings: PolicySettings = PolicySettingsSchema.parse({})

/** The `policies` key of `store.preferences`, falling back to empty for anything missing or invalid. */
export function parsePolicySettings(preferences: unknown): PolicySettings {
  const raw =
    preferences && typeof preferences === 'object'
      ? (preferences as { policies?: unknown }).policies
      : undefined
  const r = PolicySettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultPolicySettings
}

/** The grievance officer, or null until a name and a way to reach them are filled in. */
export function grievanceOfficerOf(preferences: unknown): GrievanceOfficer | null {
  const g = parsePolicySettings(preferences).grievanceOfficer
  return g.name && (g.email || g.phone) ? g : null
}

/** A published policy as the storefront links it. */
export type PolicyLink = { type: PolicyType; title: string; href: string }

/** Required policies that are not published yet, in the order Settings lists them. */
export function missingRequiredPolicies(published: readonly PolicyType[]): PolicyType[] {
  return REQUIRED_POLICY_TYPES.filter((t) => !published.includes(t))
}

/**
 * The delivery promise across the store's rates: the fastest minimum and the
 * slowest maximum. A rate without its own days uses the store's defaults.
 */
export function transitRange(
  rates: readonly { min: number | null; max: number | null }[],
  defaultMin: number,
  defaultMax: number,
): { minDays: number; maxDays: number } {
  if (rates.length === 0) return { minDays: defaultMin, maxDays: defaultMax }
  const mins = rates.map((r) => r.min ?? defaultMin)
  const maxes = rates.map((r) => r.max ?? defaultMax)
  const minDays = Math.min(...mins)
  return { minDays, maxDays: Math.max(minDays, ...maxes) }
}
