/**
 * India Post adapter: Speed Post Parcel, optionally registered, prepaid or cash on delivery.
 *
 * WHAT IS AN API AND WHAT IS NOT (checked 2026-10-20)
 *
 *   PIN codes       data.gov.in's All India Pincode Directory API (official, GODL-India), with
 *                   the merchant's own free key; else the bundled directory; else the digits.
 *                   See pin-directory.ts.
 *   Rates           India Post's published Speed Post Parcel tariff (data file, retail or
 *                   contractual card), or the merchant's own card. No rate API exists.
 *   Booking         MANUAL. India Post's booking API is for contracted bulk customers only,
 *                   onboarded through their Business Development team (the "DoP Integration with
 *                   Bulk Customers" SOP, CEPT API portal behind a login, per customer IP). It has
 *                   no public documentation, so nothing here calls it. The merchant books at the
 *                   counter (or in their bulk-customer portal) and types the article number from
 *                   the receipt; `createShipment` checks it (UPU S10 format and check digit).
 *   Label           Ours: an address label PDF with a Code 128 barcode of the article number,
 *                   rendered by `./label` and served at `/apps/india-post/labels/<number>`.
 *   Tracking        MANUAL. indiapost.gov.in's Track & Trace is a web page; its data feed is
 *                   part of the same bulk-customer integration, and the public page documents
 *                   no feed or terms for automated reading, so we do not scrape it. The shared
 *                   poll job skips India Post (`tracksManually`), the merchant moves the status
 *                   by hand in the app, and shoppers get a link to indiapost.gov.in to paste
 *                   the number.
 *   Cancel          Ours only: a counter booking cannot be undone from here; cancelling marks the
 *                   shipment cancelled so the parcel can be booked again.
 *
 * Nothing in this file needs a secret except the optional data.gov.in key.
 */
import {
  CourierError,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type CredentialCheck,
  isValidPincode,
  type PincodeDirectory,
  type ProviderField,
  type RateCharge,
  type RateOption,
  type RateQuery,
  type RateQuote,
  type Serviceability,
  type ServiceabilityQuery,
  type ShipmentStatus,
  type ShippingProvider,
  type ShippingProviderFactory,
  type Tracking,
} from '@commerce/shipping'
import { ARTICLE_NUMBER_PROBLEMS, parseArticleNumber } from './article-number'
import {
  INDIA_POST_CAPABILITIES,
  INDIA_POST_ID,
  INDIA_POST_TRACKING_PAGE,
  indiaPostLabelPath,
} from './client'
import type { TariffCard } from './data/speed-post-parcel-tariff'
import { PinDirectory } from './pin-directory'
import { parseTariffOverride, priceParcel, publishedCard, type TariffPrice } from './tariff'
import { type IndiaPostZone, type PinPlace, TRANSIT_DAYS, tariffZoneOf, zoneFor } from './zones'

export type IndiaPostConfig = {
  originPincode: string
  /** Speed Post (bulk / BNPL) customer ID, printed on the label; optional for walk-in senders. */
  customerId?: string | undefined
  /** Price from the contractual card (bulk customers) instead of the retail one. */
  contractRates: boolean
  /** The merchant's India Post business account collects cash on delivery. */
  codEnabled: boolean
  /** What India Post charges the merchant per COD parcel, in paise (their agreement says). */
  codFeePaise: number
  /** data.gov.in API key for live PIN code lookups (post office names). */
  dataGovApiKey?: string | undefined
  /** The merchant's own rate card, replacing the published one. */
  tariffOverride?: TariffCard | undefined
}

export type IndiaPostDeps = {
  fetchImpl?: typeof fetch | undefined
  loadDirectory?: (() => Promise<PincodeDirectory | null>) | undefined
  now?: (() => number) | undefined
}

export const SPEED_POST = 'speed_post'
export const SPEED_POST_REGISTERED = 'speed_post_registered'

/** Statuses the merchant can set by hand, India Post's wording for each (the label on its tracker). */
export const MANUAL_STATUS_WORDING: Record<Exclude<ShipmentStatus, 'cancelled'>, string> = {
  created: 'Booked',
  picked_up: 'Item Booked / Dispatched',
  in_transit: 'Item Bagged / In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Item Delivered',
  rto: 'Item Returned to Sender',
}

/**
 * Map India Post tracker wording to our status, for a merchant pasting the last line of the
 * indiapost.gov.in event list. Unknown wording is "in transit": it is booked and not delivered.
 */
export function mapIndiaPostStatus(raw: string): ShipmentStatus {
  const s = raw.toLowerCase()
  if (/return(ed)? to sender|rts|delivered to sender|return.*delivered/.test(s)) return 'rto'
  if (/out for delivery|sent for delivery|item onhold/.test(s)) return 'out_for_delivery'
  if (/\bdelivered\b/.test(s)) return 'delivered'
  if (/booked|accepted|received at counter/.test(s)) return 'picked_up'
  return 'in_transit'
}

/** Label facts the shipment row does not keep, carried in its `providerRef`. */
export type LabelRef = { registered: boolean; codPaise: number }

export function encodeLabelRef(ref: LabelRef): string {
  return `svc=${ref.registered ? 'registered' : 'speed'};cod=${ref.codPaise}`
}

export function decodeLabelRef(raw: string | null | undefined): LabelRef {
  const parts = new Map(
    (raw ?? '').split(';').map((p) => p.split('=') as [string, string | undefined]),
  )
  const cod = Number(parts.get('cod') ?? 0)
  return { registered: parts.get('svc') === 'registered', codPaise: Number.isFinite(cod) ? cod : 0 }
}

export function trackingUrlFor(_articleNumber: string): string {
  // India Post's tracker takes no number in the link (checked 2026-10-20): it opens empty.
  return INDIA_POST_TRACKING_PAGE
}

function chargesOf(p: TariffPrice): RateCharge[] {
  return [
    { kind: 'freight', pricePaise: p.freightPaise },
    ...(p.registrationPaise ? [{ kind: 'other' as const, pricePaise: p.registrationPaise }] : []),
    ...(p.codFeePaise ? [{ kind: 'cod' as const, pricePaise: p.codFeePaise }] : []),
    { kind: 'gst', pricePaise: p.gstPaise },
  ]
}

export class IndiaPostProvider implements ShippingProvider {
  readonly id = INDIA_POST_ID
  readonly label = 'India Post'
  readonly requiresTrackingNumber = true
  readonly tracksManually = true

  private readonly config: IndiaPostConfig
  private readonly directory: PinDirectory

  constructor(config: IndiaPostConfig, deps: IndiaPostDeps = {}) {
    this.config = config
    this.directory = new PinDirectory({
      apiKey: config.dataGovApiKey,
      fetchImpl: deps.fetchImpl,
      loadDirectory: deps.loadDirectory ?? defaultDirectory,
      now: deps.now,
    })
  }

  /** Printed on the label; never a secret. */
  get customerId(): string | undefined {
    return this.config.customerId
  }

  /** The PIN code's post offices, district and state; null when the directory has no such PIN. */
  place(pincode: string): Promise<PinPlace | null> {
    return this.directory.lookup(pincode)
  }

  private async route(origin: string, destination: string) {
    const [from, to] = await Promise.all([this.place(origin), this.place(destination)])
    return { from, to, zone: from && to ? zoneFor(from, to) : null }
  }

  private card(): TariffCard {
    return this.config.tariffOverride ?? publishedCard(this.config.contractRates)
  }

  private price(zone: IndiaPostZone, weightGrams: number, registered: boolean, cod: boolean) {
    return priceParcel(this.card(), tariffZoneOf(zone), weightGrams, {
      registered,
      codFeePaise: cod ? this.config.codFeePaise : 0,
    })
  }

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const no = (reason: string): Serviceability => ({
      provider: this.id,
      serviceable: false,
      codAvailable: false,
      prepaidAvailable: false,
      minTransitDays: null,
      maxTransitDays: null,
      reason,
    })
    if (!isValidPincode(query.destinationPincode)) return no('not a PIN code')
    const { to, zone } = await this.route(query.originPincode, query.destinationPincode)
    if (!to || !zone) return no('PIN code not in the India Post directory')
    const days = TRANSIT_DAYS[zone]
    return {
      provider: this.id,
      serviceable: true,
      codAvailable: this.config.codEnabled,
      prepaidAvailable: true,
      minTransitDays: days.min,
      maxTransitDays: days.max,
      reason: null,
    }
  }

  async quoteOptions(query: RateQuery): Promise<RateOption[]> {
    const { zone } = await this.route(query.originPincode, query.destinationPincode)
    if (!zone) return []
    const cod = query.paymentMode === 'cod'
    if (cod && !this.config.codEnabled) return []
    const days = TRANSIT_DAYS[zone]
    return [
      { id: SPEED_POST, label: 'Speed Post', registered: false },
      { id: SPEED_POST_REGISTERED, label: 'Speed Post, registered', registered: true },
    ].flatMap((s) => {
      const price = this.price(zone, query.weightGrams, s.registered, cod)
      if (!price) return []
      return [
        {
          serviceId: s.id,
          serviceLabel: s.label,
          carrier: null,
          pricePaise: price.totalPaise,
          minTransitDays: days.min,
          maxTransitDays: days.max,
          codAvailable: this.config.codEnabled,
          charges: chargesOf(price),
          chargeableWeightGrams: Math.max(1, Math.ceil(query.weightGrams)),
        },
      ]
    })
  }

  async quoteRate(query: RateQuery): Promise<RateQuote | null> {
    const [cheapest] = await this.quoteOptions(query)
    return cheapest
      ? {
          pricePaise: cheapest.pricePaise,
          minTransitDays: cheapest.minTransitDays,
          maxTransitDays: cheapest.maxTransitDays,
        }
      : null
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const parsed = parseArticleNumber(input.trackingNumber)
    if (!parsed.ok) {
      throw new CourierError('rejected', this.id, ARTICLE_NUMBER_PROBLEMS[parsed.reason])
    }
    if (input.paymentMode === 'cod' && !this.config.codEnabled) {
      throw new CourierError(
        'rejected',
        this.id,
        'Cash on delivery is off for India Post. Turn it on in Apps › India Post › Connect once your India Post business account collects COD, or ship this order prepaid.',
      )
    }
    const registered = input.serviceId === SPEED_POST_REGISTERED || parsed.kind === 'registered'
    const cod = input.paymentMode === 'cod'
    const { zone } = await this.route(input.from.pincode, input.to.pincode).catch(() => ({
      zone: null,
    }))
    const price = zone ? this.price(zone, input.weightGrams, registered, cod) : null
    return {
      waybill: parsed.number,
      providerRef: encodeLabelRef({ registered, codPaise: cod ? input.codAmountPaise : 0 }),
      labelUrl: indiaPostLabelPath(parsed.number),
      trackingUrl: trackingUrlFor(parsed.number),
      ...(price ? { chargePaise: price.totalPaise } : {}),
    }
  }

  async track(_waybill: string): Promise<Tracking> {
    throw new CourierError(
      'rejected',
      this.id,
      'India Post has no tracking feed for us to read. Update the status in Apps › India Post, or open indiapost.gov.in and paste the article number.',
    )
  }

  async cancel(_waybill: string): Promise<void> {
    // A counter booking cannot be undone from here; the shipment is only marked cancelled.
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    if (!isValidPincode(this.config.originPincode)) {
      return { ok: false, message: 'Enter the 6-digit PIN code your parcels are booked from.' }
    }
    if (!this.config.dataGovApiKey) {
      return {
        ok: true,
        message:
          'Ready. Rates come from India Post’s published tariff. Add a data.gov.in API key to show post office names for each PIN code.',
      }
    }
    try {
      const place = await this.directory.fromApi(this.config.originPincode)
      if (!place) {
        return {
          ok: false,
          message: `data.gov.in has no post office for ${this.config.originPincode}. Check the origin PIN code.`,
        }
      }
      const where = [place.offices[0], place.district].filter(Boolean).join(', ')
      return { ok: true, message: `Connected to data.gov.in. Your parcels leave from ${where}.` }
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'auth') {
        return {
          ok: false,
          message:
            'data.gov.in did not accept that API key. Copy it again from your data.gov.in account (My Account › API keys).',
        }
      }
      return {
        ok: false,
        message: 'Could not reach data.gov.in just now. Try again in a minute.',
      }
    }
  }
}

/** The bundled directory file, loaded lazily so importing the plugin never touches the disk. */
async function defaultDirectory(): Promise<PincodeDirectory | null> {
  const { loadPincodeDirectory } = await import('@commerce/shipping/pincode-directory')
  return loadPincodeDirectory()
}

const FIELDS: ProviderField[] = [
  {
    key: 'originPincode',
    label: 'Origin PIN code',
    required: true,
    help: 'The PIN code of the post office you book parcels at.',
  },
  {
    key: 'customerId',
    label: 'Speed Post customer ID',
    help: 'Your India Post business (BNPL) customer ID, if you have one. Printed on the label.',
  },
  {
    key: 'contractRates',
    label: 'I have contract rates',
    type: 'boolean',
    help: 'Price parcels from India Post’s contractual card (bulk customers) instead of the counter rates.',
  },
  {
    key: 'codEnabled',
    label: 'Cash on delivery',
    type: 'boolean',
    help: 'Turn on only when your India Post business account collects COD.',
  },
  {
    key: 'codFeeRupees',
    label: 'COD fee per parcel (₹)',
    help: 'What India Post charges you per COD parcel, from your agreement. Added to the rate shown.',
  },
  {
    key: 'dataGovApiKey',
    label: 'data.gov.in API key',
    secret: true,
    help: 'Optional. Free from data.gov.in; shows the post office for each PIN code.',
  },
  {
    key: 'tariffOverride',
    label: 'Your own rates (JSON)',
    multiline: true,
    help: 'Optional. Replaces India Post’s published tariff with your negotiated card, same shape.',
  },
]

export const indiaPostFactory: ShippingProviderFactory<IndiaPostConfig> = {
  id: INDIA_POST_ID,
  label: 'India Post',
  fields: FIELDS,
  capabilities: INDIA_POST_CAPABILITIES,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    const originPincode = r.originPincode?.trim() ?? ''
    if (!isValidPincode(originPincode)) errors.push('origin PIN code must be 6 digits')
    const feeText = r.codFeeRupees?.trim() ?? ''
    const fee = feeText ? Number(feeText) : 0
    if (!Number.isFinite(fee) || fee < 0) errors.push('COD fee must be a number of rupees')
    let tariffOverride: TariffCard | undefined
    if (r.tariffOverride?.trim()) {
      const parsed = parseTariffOverride(r.tariffOverride)
      if (parsed.ok) tariffOverride = parsed.card
      else errors.push(parsed.error)
    }
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        originPincode,
        customerId: r.customerId?.trim() || undefined,
        contractRates: r.contractRates === 'true',
        codEnabled: r.codEnabled === 'true',
        codFeePaise: Math.round(fee * 100),
        dataGovApiKey: r.dataGovApiKey?.trim() || undefined,
        tariffOverride,
      },
    }
  },
  create: (config) => new IndiaPostProvider(config),
}
