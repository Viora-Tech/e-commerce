/**
 * Blue Dart adapter, against the Blue Dart API Gateway (apigateway.bluedart.com, documented on
 * developer.dhl.com). A direct courier, like Delhivery: one account, its own network.
 *
 * AUTH IS TWO LAYERS. The gateway wants a JWT in a `JWTToken` header, minted from the app's
 * Client ID + secret (DHL developer portal → My Apps). Every request body also carries a
 * `Profile` with the Blue Dart LoginID and licence key, which is what Blue Dart itself checks.
 * The JWT is cached per account until shortly before it expires and minted again on a 401.
 *
 *   GET  /in/transportation/token/v1/login                     JWT from ClientID + clientSecret
 *   POST /in/transportation/finder/v1/GetServicesforPincode     serviceability (+ COD) per PIN
 *   POST /in/transportation/transit/v1/GetDomestic...           expected delivery date
 *   POST /in/transportation/waybill/v1/GenerateWayBill          AWB + label PDF (+ pickup)
 *   POST /in/transportation/waybill/v1/CancelWaybill            cancel by AWB
 *   POST /in/transportation/pickup/v1/RegisterPickup            pickup for a batch
 *   GET  /in/transportation/tracking/v1?handler=tnt&...         status + scans
 *
 * Request shapes follow the published field lists; response shapes are the best documented
 * ones and are marked "verify with a live account" in ./api.ts, the only file that knows
 * Blue Dart's JSON. Tracking is polled by the worker's shared job (no self-serve webhook).
 */

import {
  CourierError,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type CredentialCheck,
  courierBaseUrlProblem,
  isValidPincode,
  type ProviderField,
  type SchedulePickupInput,
  type SchedulePickupResult,
  type Serviceability,
  type ServiceabilityQuery,
  type ShippingProvider,
  type ShippingProviderFactory,
  type Tracking,
  type TrackingEvent,
} from '@commerce/shipping'
import {
  BLUEDART_PATHS,
  type BluedartProfile,
  bluedartDate,
  bluedartError,
  decodePrintContent,
  indiaDay,
  isYes,
  mapBluedartStatus,
  type PickupResult,
  type PincodeResult,
  parseBluedartDate,
  pickupSlot,
  type TrackResponse,
  type TrackScan,
  type TransitResult,
  unwrap,
  type WaybillResult,
  waybillRequest,
} from './api'
import { BLUEDART_BASE_URL, BLUEDART_CAPABILITIES, BLUEDART_SANDBOX_URL } from './client'
import { BluedartGateway } from './gateway'

export type BluedartConfig = {
  /** API Gateway app key (DHL developer portal → My Apps → Consumer Key). */
  clientId: string
  clientSecret: string
  /** Blue Dart LoginID and licence key, sent in every request's Profile. */
  loginId: string
  licenceKey: string
  /** Blue Dart customer (billing) code for the account. */
  customerCode: string
  /** Blue Dart's 3-letter area code for the origin, e.g. "DEL"; must match the origin PIN. */
  originArea: string
  originPincode: string
  baseUrl?: string | undefined
  /** "A" Apex (air) by default; "E" surface. [verify] the codes your contract carries. */
  productCode?: string | undefined
  /** Register a pickup with each waybill (Services.RegisterPickup). On unless switched off. */
  registerPickup?: boolean | undefined
  /** Pickup address and phone for "Schedule pickup" from the Shipments workspace. */
  pickupAddress?: string | undefined
  pickupPhone?: string | undefined
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch | undefined
  /** Injected for tests; defaults to the clock. */
  now?: (() => Date) | undefined
}

/** Waybill answers carry a label PDF, so they get longer than a storefront lookup. */
const BOOKING_TIMEOUT_MS = 20_000

const NOT_SERVED = 'Blue Dart does not currently deliver to this PIN code.'

export class BluedartProvider implements ShippingProvider {
  readonly id = 'bluedart'
  readonly label = 'Blue Dart'

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly now: () => Date
  private readonly gateway: BluedartGateway

  constructor(private readonly config: BluedartConfig) {
    this.baseUrl = (config.baseUrl || BLUEDART_BASE_URL).replace(/\/+$/, '')
    this.fetchImpl = config.fetchImpl ?? fetch
    this.now = config.now ?? (() => new Date())
    this.gateway = new BluedartGateway({
      baseUrl: this.baseUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      fetchImpl: this.fetchImpl,
    })
  }

  private get profile(): BluedartProfile {
    return { LoginID: this.config.loginId, LicenceKey: this.config.licenceKey, Api_type: 'S' }
  }

  /** The PIN code's service flags, or null when Blue Dart says it does not know the PIN. */
  private async pincode(pin: string): Promise<PincodeResult | null> {
    const body = await this.gateway
      .call<unknown>(BLUEDART_PATHS.pincode, {
        body: { pinCode: pin, profile: this.profile },
      })
      .catch((error: unknown) => {
        // An unknown PIN comes back as a 400 with a reason: a real "no", not a failure.
        if (error instanceof CourierError && error.kind === 'rejected') return null
        throw error
      })
    const result = unwrap<PincodeResult>(body, 'GetServicesforPincodeResult')
    if (!result || bluedartError(result) || !(result.AreaCode || result.ServiceCenterCode))
      return null
    return result
  }

  /** Whole days until Blue Dart's expected delivery date, or null. Never throws. */
  private async transitDays(origin: string, destination: string): Promise<number | null> {
    try {
      const now = this.now()
      const body = await this.gateway.call<unknown>(BLUEDART_PATHS.transit, {
        body: {
          ppinCode: origin,
          pPinCodeTo: destination,
          pProductCode: this.config.productCode ?? 'A',
          pSubProductCode: 'P',
          pPudate: bluedartDate(pickupSlot(now).date),
          pPickupTime: '16:00',
          profile: this.profile,
        },
      })
      const result = unwrap<TransitResult>(body, 'GetDomesticTransitTimeForPinCodeandProductResult')
      if (!result || bluedartError(result)) return null
      const at = parseBluedartDate(result.ExpectedDateDelivery ?? result.ExpectedDatePOD)
      if (!at) return null
      const days = Math.ceil((Date.parse(at) - now.getTime()) / 86_400_000)
      return days >= 1 && days < 60 ? days : null
    } catch {
      return null
    }
  }

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const pin = await this.pincode(query.destinationPincode)
    const flags = pin
      ? [
          pin.ApexInbound,
          pin.eTailPrePaidAirInbound,
          pin.eTailCODAirInbound,
          pin.eTailPrePaidGroundInbound,
          pin.eTailCODGroundInbound,
          pin.GroundInbound,
        ].filter((f) => f !== undefined)
      : []
    // A PIN with an area code and no inbound flags in the answer is served; flags that are all
    // "No" mean Blue Dart knows the PIN but will not deliver there.
    const serviceable = pin !== null && (flags.length === 0 || flags.some(isYes))
    if (!pin || !serviceable) {
      return {
        provider: this.id,
        serviceable: false,
        codAvailable: false,
        prepaidAvailable: false,
        minTransitDays: null,
        maxTransitDays: null,
        reason: NOT_SERVED,
      }
    }
    const days = await this.transitDays(query.originPincode, query.destinationPincode)
    const codFlags = [pin.eTailCODAirInbound, pin.eTailCODGroundInbound]
    return {
      provider: this.id,
      serviceable: true,
      codAvailable: codFlags.some(isYes),
      prepaidAvailable:
        flags.length === 0 ||
        [pin.ApexInbound, pin.eTailPrePaidAirInbound, pin.eTailPrePaidGroundInbound].some(isYes),
      minTransitDays: days,
      maxTransitDays: days,
      reason: null,
    }
  }

  /** The exact JSON GenerateWayBill wants, built from our neutral input. */
  buildWaybillPayload(input: CreateShipmentInput) {
    const now = this.now()
    // Blue Dart refuses a CreditReferenceNo it has seen ("Waybill already generated"), so a
    // re-booking after a cancel gets a fresh suffix. Max 20 characters.
    const creditReference = `${input.orderNumber}-${now.getTime().toString(36)}`.slice(0, 20)
    return {
      Request: waybillRequest(input, {
        customerCode: this.config.customerCode,
        originArea: this.config.originArea,
        productCode: input.serviceId || this.config.productCode || 'A',
        registerPickup: this.config.registerPickup !== false,
        creditReference,
        now,
      }),
      Profile: this.profile,
    }
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const body = await this.gateway
      .call<unknown>(BLUEDART_PATHS.generateWaybill, {
        body: this.buildWaybillPayload(input),
        timeoutMs: BOOKING_TIMEOUT_MS,
      })
      .catch((error: unknown) => {
        if (error instanceof CourierError && error.kind === 'rejected') {
          throw new CourierError(
            'rejected',
            this.id,
            `Blue Dart rejected the shipment: ${error.message}${/area/i.test(error.message) ? ' Check the origin area code in Apps → Blue Dart → Connect matches your origin PIN code.' : ''}`,
          )
        }
        throw error
      })
    const result = unwrap<WaybillResult>(body, 'GenerateWayBillResult')
    const reason = bluedartError(result)
    if (reason)
      throw new CourierError('rejected', this.id, `Blue Dart rejected the shipment: ${reason}`)
    const waybill = result?.AWBNo?.trim()
    if (!waybill) throw new CourierError('bad_response', this.id, 'Blue Dart returned no waybill.')
    const label = decodePrintContent(result?.AWBPrintContent)
    return {
      waybill,
      providerRef: waybill,
      ...(label ? { labelDocument: { contentType: 'application/pdf', body: label } } : {}),
    }
  }

  async cancel(waybill: string): Promise<void> {
    const body = await this.gateway.call<unknown>(BLUEDART_PATHS.cancelWaybill, {
      body: { Request: { AWBNo: waybill }, Profile: this.profile },
    })
    const reason = bluedartError(unwrap(body, 'CancelWaybillResult'))
    if (reason) throw new CourierError('rejected', this.id, `Blue Dart could not cancel: ${reason}`)
  }

  /**
   * RegisterPickup for a batch. Blue Dart collects from an address, not a named warehouse, so
   * this needs the pickup address and phone from the Connect page's Advanced section (a
   * waybill booked with "register pickup" already has its pickup and needs none of this).
   */
  async schedulePickup(input: SchedulePickupInput): Promise<SchedulePickupResult> {
    const address = this.config.pickupAddress?.trim()
    const phone = this.config.pickupPhone?.replace(/\D/g, '').slice(-10)
    if (!address || !phone) {
      throw new CourierError(
        'rejected',
        this.id,
        'Add the pickup address and phone in Apps → Blue Dart → Connect → Advanced to schedule a pickup.',
      )
    }
    const [y, m, d] = input.date.split('-').map(Number)
    const day = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
    const lines = address.match(/.{1,30}(\s|$)/g)?.map((l) => l.trim()) ?? [address]
    const body = await this.gateway.call<unknown>(BLUEDART_PATHS.registerPickup, {
      body: {
        request: {
          AreaCode: this.config.originArea,
          CustomerCode: this.config.customerCode,
          CustomerName: input.pickupLocationName.slice(0, 30),
          ContactPersonName: input.pickupLocationName.slice(0, 30),
          CustomerAddress1: lines[0] ?? '',
          CustomerAddress2: lines[1] ?? '',
          CustomerAddress3: lines[2] ?? '',
          CustomerPincode: this.config.originPincode,
          CustomerTelephoneNumber: '',
          MobileTelNo: phone,
          EmailID: '',
          NumberofPieces: input.expectedPackageCount,
          WeightofShipment: Math.max(0.5, input.expectedPackageCount * 0.5),
          VolumeWeight: Math.max(0.5, input.expectedPackageCount * 0.5),
          ShipmentPickupDate: bluedartDate(day),
          ShipmentPickupTime: input.timeFrom,
          OfficeCloseTime: input.timeTo ?? '18:00',
          ProductCode: this.config.productCode ?? 'A',
          SubProducts: ['E-Tail'],
          DoxNDox: '2',
          PackType: '',
          RouteCode: '',
          AWBNo: [],
          ReferenceNo: '',
          Remarks: '',
          IsForcePickup: false,
          IsReversePickup: false,
          isToPayShipper: false,
          CISDDN: false,
        },
        profile: this.profile,
      },
    })
    const result = unwrap<PickupResult>(body, 'RegisterPickupResult')
    const reason = bluedartError(result)
    if (reason)
      throw new CourierError('rejected', this.id, `Blue Dart refused the pickup: ${reason}`)
    if (!result?.TokenNumber) {
      throw new CourierError('bad_response', this.id, 'Blue Dart did not return a pickup token.')
    }
    return { providerPickupId: String(result.TokenNumber) }
  }

  async track(waybill: string): Promise<Tracking> {
    const q = new URLSearchParams({
      handler: 'tnt',
      action: 'custawbquery',
      loginid: this.config.loginId,
      awb: 'awb',
      numbers: waybill,
      format: 'json',
      lickey: this.config.licenceKey,
      verno: '1',
      scan: '1',
    })
    const data = await this.gateway.call<TrackResponse>(`${BLUEDART_PATHS.tracking}?${q}`, {
      method: 'GET',
    })
    const list = data.ShipmentData?.Shipment
    const shipment = Array.isArray(list) ? list[0] : list
    if (!shipment) {
      throw new CourierError('bad_response', this.id, 'Blue Dart has no record of this waybill.')
    }
    const rawScans = Array.isArray(shipment.Scans)
      ? shipment.Scans.map((s: TrackScan) => s.ScanDetail)
      : (shipment.Scans?.ScanDetail ?? [])
    const events: TrackingEvent[] = rawScans
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .map((d) => ({
        at: parseBluedartDate(d.ScanDate, d.ScanTime) ?? new Date(0).toISOString(),
        status: mapBluedartStatus(d.ScanType, d.Scan),
        description: d.Scan ?? '',
        location: d.ScannedLocation,
      }))
      .sort((a, b) => a.at.localeCompare(b.at))
    const expected = parseBluedartDate(shipment.ExpectedDeliveryDate)
    return {
      waybill: shipment.WaybillNo ?? waybill,
      status: mapBluedartStatus(shipment.StatusType, shipment.Status),
      events,
      trackingUrl: `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${encodeURIComponent(waybill)}`,
      ...(expected ? { expectedDate: indiaDay(expected) } : {}),
    }
  }

  /** Mints a token and looks up a PIN code certain to exist, so a failure means the keys. */
  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      const pin = await this.pincode(this.config.originPincode || '110001')
      return pin
        ? { ok: true, message: `Connected to Blue Dart at ${this.baseUrl}.` }
        : {
            ok: false,
            message: `Blue Dart accepted the keys but does not know PIN ${this.config.originPincode}.`,
          }
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'auth') {
        return {
          ok: false,
          message:
            'Blue Dart rejected the keys. Check the Client ID and secret from the DHL developer portal (My Apps), and that the Test/Live switch matches where they were issued.',
        }
      }
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not verify the Blue Dart keys.',
      }
    }
  }
}

const fields: ProviderField[] = [
  {
    key: 'clientId',
    label: 'Client ID',
    required: true,
    help: 'DHL developer portal → My Apps → your Blue Dart app → Consumer Key.',
  },
  { key: 'clientSecret', label: 'Client secret', secret: true, required: true },
  {
    key: 'loginId',
    label: 'Login ID',
    required: true,
    help: 'Given by Blue Dart with your API access.',
  },
  { key: 'licenceKey', label: 'Licence key', secret: true, required: true },
  { key: 'customerCode', label: 'Customer code', required: true },
  {
    key: 'originArea',
    label: 'Origin area code',
    required: true,
    help: 'Blue Dart’s 3-letter area code for the PIN code you ship from, e.g. DEL.',
  },
  { key: 'originPincode', label: 'Origin PIN code', required: true },
  {
    key: 'baseUrl',
    label: 'API base URL',
    help: `Leave blank for production. Sandbox: ${BLUEDART_SANDBOX_URL}`,
  },
  {
    key: 'surfaceMode',
    label: 'Book Surface instead of Apex (air)',
    type: 'boolean',
    help: 'Off books Apex, Blue Dart’s air service.',
  },
  {
    key: 'registerPickup',
    label: 'Register a pickup with every waybill',
    type: 'boolean',
    help: 'On by default.',
  },
  { key: 'pickupAddress', label: 'Pickup address', help: 'For scheduling pickups from Shipments.' },
  { key: 'pickupPhone', label: 'Pickup phone' },
]

export const bluedartFactory: ShippingProviderFactory<BluedartConfig> = {
  id: 'bluedart',
  label: 'Blue Dart',
  fields,
  capabilities: BLUEDART_CAPABILITIES,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    if (!r.clientId?.trim()) errors.push('client ID is required')
    if (!r.clientSecret?.trim()) errors.push('client secret is required')
    if (!r.loginId?.trim()) errors.push('login ID is required')
    if (!r.licenceKey?.trim()) errors.push('licence key is required')
    if (!r.customerCode?.trim()) errors.push('customer code is required')
    if (!/^[A-Za-z]{3}$/.test(r.originArea?.trim() ?? '')) {
      errors.push('origin area code must be 3 letters')
    }
    if (!isValidPincode(r.originPincode?.trim())) errors.push('origin PIN code must be 6 digits')
    const baseUrlProblem = courierBaseUrlProblem(r.baseUrl, ['bluedart.com'])
    if (baseUrlProblem) errors.push(baseUrlProblem)
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        clientId: (r.clientId as string).trim(),
        clientSecret: (r.clientSecret as string).trim(),
        loginId: (r.loginId as string).trim(),
        licenceKey: (r.licenceKey as string).trim(),
        customerCode: (r.customerCode as string).trim(),
        originArea: (r.originArea as string).trim().toUpperCase(),
        originPincode: (r.originPincode as string).trim(),
        baseUrl: r.baseUrl?.trim() || undefined,
        productCode: r.surfaceMode === 'true' ? 'E' : 'A',
        registerPickup: r.registerPickup !== 'false',
        pickupAddress: r.pickupAddress?.trim() || undefined,
        pickupPhone: r.pickupPhone?.trim() || undefined,
      },
    }
  },
  create: (config) => new BluedartProvider(config),
}
