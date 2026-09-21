import {
  type DeliveryEstimate,
  estimateDelivery,
  fakeShippingFactory,
  isValidPincode,
  type Serviceability,
  type ShippingPolicy,
  type ShippingProvider,
  ShippingRegistry,
} from '@commerce/shipping'
import { z } from 'zod'
import {
  decryptProviderSettings,
  encryptProviderSettings,
  maskProviderSettings,
} from '../settings/secrets'

/**
 * The dispatch policy is store-wide, not per courier: which days the
 * warehouse packs and when the manifest closes are facts about the merchant,
 * whichever carrier collects the parcel.
 */
export const ShippingPolicySchema = z.object({
  originPincode: z.string().refine(isValidPincode, 'must be a 6-digit PIN code').default('110001'),
  /** "HH:mm" local wall-clock cutoff after which orders dispatch next working day. */
  cutoff: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/, 'must look like 14:00')
    .default('14:00'),
  timeZone: z.string().default('Asia/Kolkata'),
  /** ISO weekdays the warehouse dispatches: Mon=1 .. Sun=7. */
  workingDays: z.array(z.number().int().min(1).max(7)).min(1).default([1, 2, 3, 4, 5, 6]),
  /** Days couriers deliver. Indian couriers deliver on Sundays. */
  deliveryDays: z.array(z.number().int().min(1).max(7)).default([1, 2, 3, 4, 5, 6, 7]),
  /** "YYYY-MM-DD" one-offs or "MM-DD" every year. */
  holidays: z.array(z.string()).default([]),
  defaultMinTransitDays: z.number().int().min(1).max(30).default(3),
  defaultMaxTransitDays: z.number().int().min(1).max(30).default(6),
  codAllowed: z.boolean().default(true),
  /** Return address printed on labels; falls back to the pickup location. */
  warehouse: z
    .object({
      name: z.string().default(''),
      line1: z.string().default(''),
      line2: z.string().default(''),
      city: z.string().default(''),
      state: z.string().default(''),
      phone: z.string().default(''),
    })
    .default({ name: '', line1: '', line2: '', city: '', state: '', phone: '' }),
})

/** Stored on store.shipping. Secret fields are encrypted before they reach the row. */
export const ShippingSettingsSchema = z.object({
  /** Couriers in preference order; the first is asked for estimates and used for shipments. */
  enabled: z.array(z.string().min(1)).default([]),
  providers: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  policy: ShippingPolicySchema.default(ShippingPolicySchema.parse({})),
})
export type ShippingSettings = z.infer<typeof ShippingSettingsSchema>
export type ShippingPolicySettings = z.infer<typeof ShippingPolicySchema>

export const defaultShippingSettings: ShippingSettings = ShippingSettingsSchema.parse({})

export function parseShippingSettings(raw: unknown): ShippingSettings {
  const r = ShippingSettingsSchema.safeParse(raw)
  return r.success ? r.data : defaultShippingSettings
}

export const encryptShippingSettings = (s: ShippingSettings, secret: string): ShippingSettings =>
  encryptProviderSettings(s, secret)

export const decryptShippingSettings = (s: ShippingSettings, secret: string): ShippingSettings =>
  decryptProviderSettings(s, secret)

export const maskShippingSettings = (s: ShippingSettings): ShippingSettings =>
  maskProviderSettings(s)

/** Couriers every deployment has without an adapter package: the demo courier. */
export function builtInShippingRegistry(): ShippingRegistry {
  return new ShippingRegistry().register(fakeShippingFactory)
}

/** The policy object the calendar wants, from what is stored. */
export function toShippingPolicy(settings: ShippingSettings): ShippingPolicy {
  const p = settings.policy
  return {
    originPincode: p.originPincode,
    cutoff: p.cutoff,
    timeZone: p.timeZone,
    workingDays: p.workingDays,
    deliveryDays: p.deliveryDays,
    holidays: p.holidays,
    defaultMinTransitDays: p.defaultMinTransitDays,
    defaultMaxTransitDays: p.defaultMaxTransitDays,
    codAllowed: p.codAllowed,
  }
}

/** Build the couriers a store has enabled, in preference order, with decrypted credentials. */
export function resolveShippingProviders(
  registry: ShippingRegistry,
  settings: ShippingSettings,
  secret: string,
): { providers: ShippingProvider[]; errors: string[] } {
  const decrypted = decryptShippingSettings(settings, secret)
  const providers: ShippingProvider[] = []
  const errors: string[] = []
  for (const id of decrypted.enabled) {
    const r = registry.create(id, decrypted.providers[id] ?? {})
    if (r.ok) providers.push(r.provider)
    else errors.push(`${id}: ${r.errors.join(', ')}`)
  }
  return { providers, errors }
}

/** The one courier estimates and shipments go through: the first enabled and valid one. */
export function primaryShippingProvider(
  registry: ShippingRegistry,
  settings: ShippingSettings,
  secret: string,
): ShippingProvider | null {
  return resolveShippingProviders(registry, settings, secret).providers[0] ?? null
}

/** Estimate for a store, wiring settings + primary courier into the pure composer. */
export async function estimateForStore(input: {
  registry: ShippingRegistry
  settings: ShippingSettings
  secret: string
  pincode: unknown
  now?: Date | undefined
  cached?: Serviceability | null | undefined
}): Promise<DeliveryEstimate> {
  return estimateDelivery({
    pincode: input.pincode,
    policy: toShippingPolicy(input.settings),
    provider: primaryShippingProvider(input.registry, input.settings, input.secret),
    now: input.now ?? new Date(),
    cached: input.cached,
  })
}

export { ShippingRegistry }
