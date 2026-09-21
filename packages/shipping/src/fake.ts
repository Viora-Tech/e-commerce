/**
 * FakeShippingProvider - the default courier.
 *
 * This exists so the whole platform runs end to end with no courier account:
 * fresh install, no keys, and the storefront still gets a real answer computed
 * by the real date logic. It is not a stub in the sense of "returns a
 * constant" - the only thing faked is the network call.
 *
 * Two properties matter and are why this is not `Math.random()`:
 *
 *  1. **Deterministic.** The same pincode always gets the same answer, in this
 *     process and the next. A demo where refreshing the page changes the
 *     estimate is worse than no demo, and a flaky fixture makes every
 *     integration test unreliable.
 *  2. **Plausibly shaped.** Transit days track real Indian distance bands
 *     derived from the first two digits of the destination PIN (the postal
 *     circle), and a small, fixed slice of pincodes is unserviceable and
 *     another slice is prepaid-only. Without those, the "not serviceable" and
 *     "no COD" paths in the UI never get exercised before launch.
 */

import type {
  CreateShipmentInput,
  CreateShipmentResult,
  CredentialCheck,
  Serviceability,
  ServiceabilityQuery,
  ShipmentStatus,
  ShippingProvider,
  ShippingProviderFactory,
  Tracking,
} from './types'

/**
 * Postal circle (first two PIN digits) to a rough distance band. India Post
 * regions run 11-85; the band is a stand-in for "how far from a metro hub",
 * which is what actually drives transit time.
 */
function bandForPincode(pincode: string): { min: number; max: number } {
  const circle = Number(pincode.slice(0, 2))

  // Metro and near-metro circles: Delhi (11), Mumbai (40), Bengaluru (56),
  // Chennai (60), Kolkata (70), Hyderabad (50), Pune (41).
  const metros = new Set([11, 40, 41, 50, 56, 60, 70])
  if (metros.has(circle)) return { min: 1, max: 3 }

  // North-east and the island territories are genuinely slow, and are the
  // cases where an over-optimistic promise hurts most.
  const remote = new Set([73, 74, 78, 79, 68])
  if (remote.has(circle)) return { min: 5, max: 9 }

  return { min: 2, max: 5 }
}

/**
 * A small, stable hash so "unserviceable" and "prepaid only" land on a fixed
 * subset of pincodes. FNV-1a: three lines, no dependency, well-distributed
 * enough for picking demo buckets.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

export type FakeShippingConfig = Record<string, never>

export class FakeShippingProvider implements ShippingProvider {
  readonly id = 'fake'
  readonly label = 'Demo courier (no account needed)'

  /** Shipments created in this process, so track() can walk them forward. */
  private readonly created = new Map<string, { at: number }>()

  constructor(private readonly now: () => number = Date.now) {}

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const { destinationPincode, originPincode } = query
    const bucket = fnv1a(`${originPincode}->${destinationPincode}`) % 100

    // ~3% unserviceable, ~12% of the remainder prepaid-only. Both paths need to
    // be reachable in a demo without hunting for a magic pincode.
    if (bucket < 3) {
      return {
        provider: this.id,
        serviceable: false,
        codAvailable: false,
        prepaidAvailable: false,
        minTransitDays: null,
        maxTransitDays: null,
        reason: 'Demo courier: this PIN code is in the unserviceable sample.',
      }
    }

    const band = bandForPincode(destinationPincode)
    // Nudge within the band so neighbouring pincodes are not all identical.
    const jitter = bucket % 2

    return {
      provider: this.id,
      serviceable: true,
      codAvailable: bucket >= 15,
      prepaidAvailable: true,
      minTransitDays: band.min + jitter,
      maxTransitDays: band.max + jitter,
      reason: null,
    }
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const waybill = `DEMO${String(input.orderNumber).padStart(8, '0')}`
    this.created.set(waybill, { at: this.now() })
    return { waybill, providerRef: waybill }
  }

  /** Advances one stage every 12 hours after creation, so a demo order visibly moves. */
  async track(waybill: string): Promise<Tracking> {
    const stages: ShipmentStatus[] = [
      'created',
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'delivered',
    ]
    const startedAt = this.created.get(waybill)?.at ?? this.now()
    const hours = (this.now() - startedAt) / 3_600_000
    const idx = Math.min(stages.length - 1, Math.floor(hours / 12))
    const events = stages.slice(0, idx + 1).map((status, i) => ({
      at: new Date(startedAt + i * 12 * 3_600_000).toISOString(),
      status,
      description: `Demo courier: ${status.replace('_', ' ')}`,
    }))
    return { waybill, status: stages[idx] ?? 'created', events }
  }

  async cancel(waybill: string): Promise<void> {
    this.created.delete(waybill)
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    return {
      ok: true,
      message:
        'The demo courier needs no credentials. Estimates are generated locally and are NOT real courier data - switch to Delhivery before launch.',
    }
  }
}

export const fakeShippingFactory: ShippingProviderFactory<FakeShippingConfig> = {
  id: 'fake',
  label: 'Demo courier (no account needed)',
  fields: [],
  validateConfig: () => ({ ok: true, config: {} }),
  create: () => new FakeShippingProvider(),
}
