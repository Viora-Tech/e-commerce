import {
  type DeliveryEstimate,
  estimateDelivery,
  fakeShippingFactory,
  isValidPincode,
  type Serviceability,
  type ShippingPolicy,
  type ShippingProvider,
  ShippingRegistry,
  servesDestination,
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
  /**
   * "Insure above ₹X": shipments with a declared value at or above this
   * amount are insured by default when booked (a per-shipment toggle can
   * still override it). 0 means never insure automatically.
   */
  insuranceThresholdPaise: z.number().int().min(0).default(0),
  /** Balance below which the wallet card in the Shipments workspace warns the merchant. */
  lowWalletBalancePaise: z.number().int().min(0).default(50000),
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

/**
 * Which connected courier books an order when more than one is enabled.
 * `cheapest`/`fastest` read the live rate comparison (`compareCourierRates`);
 * `preferred` always books the same courier; `per_zone` routes by the
 * shipping address's state, falling back to `cheapest`/`fastest` outside its
 * zones. A single-courier store never sees this - `cheapest` with one
 * connected courier always resolves to that courier.
 */
export const CourierRuleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('cheapest') }),
  z.object({ mode: z.literal('fastest') }),
  z.object({ mode: z.literal('preferred'), providerId: z.string().min(1) }),
  z.object({
    mode: z.literal('per_zone'),
    zones: z
      .array(
        z.object({
          stateCodes: z
            .array(
              z
                .string()
                .trim()
                .toUpperCase()
                .regex(/^[A-Z]{2}$/),
            )
            .min(1),
          providerId: z.string().min(1),
        }),
      )
      .max(40)
      .default([]),
    fallback: z.enum(['cheapest', 'fastest']).default('cheapest'),
  }),
])
export type CourierRuleSettings = z.infer<typeof CourierRuleSchema>
export const defaultCourierRule: CourierRuleSettings = { mode: 'cheapest' }

/** What a saved package is (Shopify's package types, audit #162): an envelope is flat. */
export const PACKAGE_KINDS = ['box', 'envelope', 'soft_package'] as const
export type PackageKind = (typeof PACKAGE_KINDS)[number]

/** A named box the merchant packs into, for pre-filling the booking dimensions/weight. */
export const BoxPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  /** Saved before package types: a box. */
  kind: z.enum(PACKAGE_KINDS).default('box'),
  lengthCm: z.number().min(1).max(200),
  widthCm: z.number().min(1).max(200),
  heightCm: z.number().min(1).max(200),
  weightGrams: z.number().int().min(1).max(50000),
  isDefault: z.boolean().default(false),
  /**
   * What one box plus its filler costs, for order profit (packing). Before GST for a
   * GST-registered store, as paid otherwise. Null: not set, counts as ₹0 and is flagged.
   */
  costPaise: z.number().int().min(0).max(10_000_00).nullable().default(null),
})
export type BoxPreset = z.infer<typeof BoxPresetSchema>

/** Stored on store.shipping. Secret fields are encrypted before they reach the row. */
export const ShippingSettingsSchema = z.object({
  /** Couriers in preference order; the first is asked for estimates and, absent a booking rule
   *  that resolves to someone else, used for shipments. */
  enabled: z.array(z.string().min(1)).default([]),
  providers: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  policy: ShippingPolicySchema.default(ShippingPolicySchema.parse({})),
  courierRule: CourierRuleSchema.default(defaultCourierRule),
  /** Named boxes for the booking flow; one may be marked default. No migration - lives in the
   *  same JSON column as everything else here. */
  boxPresets: z.array(BoxPresetSchema).max(20).default([]),
  /** How checkout splits an order across warehouses (order/routing.ts). */
  routing: z
    .object({
      /** The most parcels one order may be split into before the default location tops up. */
      maxParcels: z.number().int().min(1).max(5).default(2),
    })
    .default({ maxParcels: 2 }),
})
export type ShippingSettings = z.infer<typeof ShippingSettingsSchema>
export type ShippingPolicySettings = z.infer<typeof ShippingPolicySchema>

/** The store's default box, if it has one - the booking flow pre-fills from it. */
export function defaultBoxPreset(settings: ShippingSettings): BoxPreset | null {
  return settings.boxPresets.find((b) => b.isDefault) ?? settings.boxPresets[0] ?? null
}

export const defaultShippingSettings: ShippingSettings = ShippingSettingsSchema.parse({})

export function parseShippingSettings(raw: unknown): ShippingSettings {
  const r = ShippingSettingsSchema.safeParse(raw)
  return r.success ? r.data : defaultShippingSettings
}

const fieldsOf = (registry: ShippingRegistry) => (id: string) => registry.get(id)?.fields

export const encryptShippingSettings = (
  s: ShippingSettings,
  secret: string,
  registry?: ShippingRegistry,
): ShippingSettings => encryptProviderSettings(s, secret, registry ? fieldsOf(registry) : undefined)

export const decryptShippingSettings = (
  s: ShippingSettings,
  secret: string,
  previousSecrets: string[] = [],
): ShippingSettings => decryptProviderSettings(s, secret, previousSecrets)

export const maskShippingSettings = (
  s: ShippingSettings,
  registry?: ShippingRegistry,
): ShippingSettings => maskProviderSettings(s, registry ? fieldsOf(registry) : undefined)

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
  previousSecrets: string[] = [],
): { providers: ShippingProvider[]; errors: string[] } {
  const decrypted = decryptShippingSettings(settings, secret, previousSecrets)
  const providers: ShippingProvider[] = []
  const errors: string[] = []
  for (const id of decrypted.enabled) {
    const r = registry.create(id, decrypted.providers[id] ?? {})
    if (r.ok) providers.push(r.provider)
    else errors.push(`${id}: ${r.errors.join(', ')}`)
  }
  return { providers, errors }
}

/**
 * The one courier estimates default to: the first enabled and valid one that delivers inside
 * India. An export-only courier (DHL Express, FedEx) is passed over, since a storefront PIN
 * code is always Indian; it is the answer only when it is all the store has.
 */
export function primaryShippingProvider(
  registry: ShippingRegistry,
  settings: ShippingSettings,
  secret: string,
  previousSecrets: string[] = [],
): ShippingProvider | null {
  const { providers } = resolveShippingProviders(registry, settings, secret, previousSecrets)
  return providers.find((p) => servesDestination(p, 'IN')) ?? providers[0] ?? null
}

/** The courier a storefront PIN-code estimate asks: the primary one, unless it only ships abroad. */
export function domesticShippingProvider(
  registry: ShippingRegistry,
  settings: ShippingSettings,
  secret: string,
): ShippingProvider | null {
  const provider = primaryShippingProvider(registry, settings, secret)
  return provider && servesDestination(provider, 'IN') ? provider : null
}

/**
 * The connected courier a specific shipment was (or should be) booked with,
 * by provider id rather than always the primary. A multi-courier store books
 * different orders with different couriers (the default rule, or a per-row
 * override), so actions on an existing shipment - cancel, NDR, a tracking
 * refresh - must reach the courier that actually holds the waybill, not
 * whichever courier happens to be first in the enabled list.
 */
export function shippingProviderById(
  registry: ShippingRegistry,
  settings: ShippingSettings,
  secret: string,
  providerId: string,
  previousSecrets: string[] = [],
): ShippingProvider | null {
  return (
    resolveShippingProviders(registry, settings, secret, previousSecrets).providers.find(
      (p) => p.id === providerId,
    ) ?? null
  )
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
    provider: domesticShippingProvider(input.registry, input.settings, input.secret),
    now: input.now ?? new Date(),
    cached: input.cached,
  })
}

export { ShippingRegistry }
