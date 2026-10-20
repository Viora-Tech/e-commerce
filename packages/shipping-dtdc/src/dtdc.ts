/**
 * DTDC adapter. DTDC's booking API runs on Shipsy (dtdcapi.shipsy.io): a static per-account
 * `api-key` header, no login cycle. Tracking is a separate DTDC service with its own username
 * and password, and the PIN code lookup is DTDC's public serviceability endpoint.
 *
 *   POST {base}/api/customer/integration/consignment/softdata          book -> AWB
 *   GET  {base}/api/customer/integration/consignment/shippinglabel/stream  label PDF
 *   POST {base}/api/customer/integration/consignment/cancel            cancel by AWB
 *   GET  blktracksvc.dtdc.com/dtdc-api/api/dtdc/authenticate             tracking token
 *   POST blktracksvc.dtdc.com/dtdc-api/rest/JSONCnTrk/getTrackDetails    status + scans
 *   POST smarttrack.ctbsplus.dtdc.com/ratecalapi/PincodeApiCall          serviceability
 *
 * DTDC gives this API kit to account holders only, so every shape is the best documented one
 * and is marked "verify with a live account" in ./api.ts, the only file that knows DTDC's JSON.
 * Tracking is polled by the worker's shared job.
 */

import {
  CourierError,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type CredentialCheck,
  courierBaseUrlProblem,
  courierFetch,
  courierJson,
  isValidPincode,
  type ProviderField,
  type Serviceability,
  type ServiceabilityQuery,
  type ShippingLabelDocument,
  type ShippingProvider,
  type ShippingProviderFactory,
  type Tracking,
  type TrackingEvent,
} from '@commerce/shipping'
import {
  type CancelResponse,
  DTDC_DEFAULT_SERVICE,
  DTDC_PATHS,
  DTDC_PINCODE_URL,
  DTDC_TRACKING_BASE_URL,
  DTDC_TRACKING_PATHS,
  mapDtdcStatus,
  type PincodeResponse,
  parseDtdcDate,
  readPincode,
  type SoftdataResponse,
  softdataConsignment,
  softdataError,
  type TrackResponse,
} from './api'
import { DTDC_BASE_URL, DTDC_CAPABILITIES, DTDC_DEMO_URL } from './client'

export type DtdcConfig = {
  apiKey: string
  /** DTDC customer code, printed on the account's welcome mail ("GL…"). */
  customerCode: string
  originPincode: string
  /** DTDC's service type id. "B2C PRIORITY" unless the contract names another. */
  serviceType?: string | undefined
  /** The tracking service's own login; without it tracking cannot be fetched. */
  trackingUsername?: string | undefined
  trackingPassword?: string | undefined
  baseUrl?: string | undefined
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch | undefined
}

/** Booking and the label stream answer slower than a storefront lookup. */
const BOOKING_TIMEOUT_MS = 20_000
/** How long a tracking token is reused before logging in again (it is refreshed on a 401 too). */
const TRACKING_TOKEN_MS = 60 * 60_000

const trackingTokens = new Map<string, { token: string; expiresAt: number }>()

const NOT_SERVED = 'DTDC does not currently deliver to this PIN code.'

export class DtdcProvider implements ShippingProvider {
  readonly id = 'dtdc'
  readonly label = 'DTDC'

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(private readonly config: DtdcConfig) {
    this.baseUrl = (config.baseUrl || DTDC_BASE_URL).replace(/\/+$/, '')
    this.fetchImpl = config.fetchImpl ?? fetch
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { 'api-key': this.config.apiKey, Accept: 'application/json', ...extra }
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await courierFetch(this.id, `${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      timeoutMs: BOOKING_TIMEOUT_MS,
      fetchImpl: this.fetchImpl,
    })
    return courierJson<T>(this.id, res)
  }

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const res = await courierFetch(this.id, DTDC_PINCODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        orgPincode: query.originPincode,
        desPincode: query.destinationPincode,
      }),
      fetchImpl: this.fetchImpl,
    })
    const { serviceable, cod } = readPincode(
      await courierJson<PincodeResponse>(this.id, res),
      query.destinationPincode,
    )
    return {
      provider: this.id,
      serviceable,
      codAvailable: serviceable && cod,
      prepaidAvailable: serviceable,
      // DTDC's lookup gives no transit time: the merchant's configured days apply.
      minTransitDays: null,
      maxTransitDays: null,
      reason: serviceable ? null : NOT_SERVED,
    }
  }

  /** The exact JSON the softdata booking wants, built from our neutral input. */
  buildSoftdataPayload(input: CreateShipmentInput) {
    return {
      consignments: [
        softdataConsignment(input, {
          customerCode: this.config.customerCode,
          serviceType: this.config.serviceType || DTDC_DEFAULT_SERVICE,
        }),
      ],
    }
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const body = await this.postJson<SoftdataResponse>(
      DTDC_PATHS.softdata,
      this.buildSoftdataPayload(input),
    )
    const reason = softdataError(body)
    if (reason) throw new CourierError('rejected', this.id, `DTDC rejected the shipment: ${reason}`)
    const waybill = body.data?.[0]?.reference_number as string
    // The booking stands even when the label is slow: it can be printed from DTDC's portal.
    const label = await this.fetchLabel(waybill).catch(() => null)
    return {
      waybill,
      providerRef: waybill,
      ...(label ? { labelDocument: label } : {}),
    }
  }

  /** The 4x6 label PDF for a booked consignment. */
  async fetchLabel(waybill: string): Promise<ShippingLabelDocument | null> {
    const q = new URLSearchParams({
      reference_number: waybill,
      label_code: 'SHIP_LABEL_4X6',
      label_format: 'pdf',
    })
    const res = await courierFetch(this.id, `${this.baseUrl}${DTDC_PATHS.label}?${q}`, {
      headers: this.headers({ Accept: 'application/pdf, application/json' }),
      timeoutMs: BOOKING_TIMEOUT_MS,
      fetchImpl: this.fetchImpl,
    })
    const type = res.headers.get('content-type') ?? ''
    // Some accounts answer JSON with the PDF base64-encoded instead of the stream.
    if (type.includes('json')) {
      const json = await courierJson<{ data?: string; label?: string }>(this.id, res)
      const b64 = json.data ?? json.label
      if (!b64) return null
      return { contentType: 'application/pdf', body: Uint8Array.from(Buffer.from(b64, 'base64')) }
    }
    const body = new Uint8Array(await res.arrayBuffer())
    return body.length ? { contentType: 'application/pdf', body } : null
  }

  async cancel(waybill: string): Promise<void> {
    const body = await this.postJson<CancelResponse>(DTDC_PATHS.cancel, {
      AWBNo: [waybill],
      customerCode: this.config.customerCode,
    })
    const failure = body.failures?.[0]
    if (body.success === false || failure) {
      throw new CourierError(
        'rejected',
        this.id,
        `DTDC could not cancel: ${failure?.reason || failure?.message || body.message || 'no detail returned'}`,
      )
    }
  }

  private get trackingKey() {
    return this.config.trackingUsername ?? ''
  }

  private async trackingToken(): Promise<string> {
    const { trackingUsername, trackingPassword } = this.config
    if (!trackingUsername || !trackingPassword) {
      throw new CourierError(
        'not_configured',
        this.id,
        'Add the DTDC tracking username and password in Apps → DTDC → Connect to track parcels.',
      )
    }
    const cached = trackingTokens.get(this.trackingKey)
    if (cached && cached.expiresAt > Date.now()) return cached.token
    const q = new URLSearchParams({ username: trackingUsername, password: trackingPassword })
    const refused = () =>
      new CourierError('auth', this.id, 'DTDC rejected the tracking username or password.')
    const res = await courierFetch(
      this.id,
      `${DTDC_TRACKING_BASE_URL}${DTDC_TRACKING_PATHS.authenticate}?${q}`,
      { fetchImpl: this.fetchImpl },
    ).catch((error: unknown) => {
      throw error instanceof CourierError && error.kind === 'auth' ? refused() : error
    })
    const text = (await res.text()).trim()
    // The token comes back as plain text; a JSON body means a refusal.
    if (!text || text.startsWith('{')) throw refused()
    trackingTokens.set(this.trackingKey, { token: text, expiresAt: Date.now() + TRACKING_TOKEN_MS })
    return text
  }

  private async trackDetails(waybill: string, retried = false): Promise<TrackResponse> {
    const token = await this.trackingToken()
    try {
      const res = await courierFetch(
        this.id,
        `${DTDC_TRACKING_BASE_URL}${DTDC_TRACKING_PATHS.track}`,
        {
          method: 'POST',
          headers: {
            'X-Access-Token': token,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ trkType: 'cnno', strcnno: waybill, addtnlDtl: 'Y' }),
          fetchImpl: this.fetchImpl,
        },
      )
      return await courierJson<TrackResponse>(this.id, res)
    } catch (error) {
      if (!retried && error instanceof CourierError && error.kind === 'auth') {
        trackingTokens.delete(this.trackingKey)
        return this.trackDetails(waybill, true)
      }
      throw error
    }
  }

  async track(waybill: string): Promise<Tracking> {
    const data = await this.trackDetails(waybill)
    const header = data.trackHeader
    if (data.statusFlag === false || !header) {
      throw new CourierError('bad_response', this.id, 'DTDC has no record of this consignment.')
    }
    const events: TrackingEvent[] = (data.trackDetails ?? [])
      .map((d) => ({
        at: parseDtdcDate(d.strActionDate, d.strActionTime) ?? new Date(0).toISOString(),
        status: mapDtdcStatus(d.strCode, d.strAction),
        description: [d.strAction, d.sTrRemarks].filter(Boolean).join(' - '),
        location: d.strOrigin || d.strDestination || undefined,
      }))
      .sort((a, b) => a.at.localeCompare(b.at))
    const latest = events[events.length - 1]
    const expected = parseDtdcDate(header.strExpectedDeliveryDate)
    return {
      waybill: header.strShipmentNo || waybill,
      status: header.strStatus
        ? mapDtdcStatus(undefined, header.strStatus)
        : (latest?.status ?? 'created'),
      events,
      trackingUrl: `https://www.dtdc.in/trace.asp?strCnno=${encodeURIComponent(waybill)}`,
      // The India calendar day: a midnight IST date is the previous day in UTC.
      ...(expected
        ? { expectedDate: new Date(Date.parse(expected) + 330 * 60_000).toISOString().slice(0, 10) }
        : {}),
    }
  }

  /**
   * The PIN code lookup is public, so it proves nothing about the key. This asks for the label
   * of a consignment that cannot exist: DTDC refuses a bad key with 401/403 and answers a good
   * one with "not found". The tracking login is checked too when it is filled in.
   */
  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      await this.fetchLabel('KOOMERCE-KEY-CHECK').catch((error: unknown) => {
        if (error instanceof CourierError && error.kind === 'unavailable' && error.status) {
          if (error.status < 500) return null
        }
        throw error
      })
      if (this.config.trackingUsername) await this.trackingToken()
      return { ok: true, message: `Connected to DTDC at ${this.baseUrl}.` }
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'auth') {
        return {
          ok: false,
          message: error.message.includes('tracking')
            ? error.message
            : 'DTDC rejected the API key. Check it is the key DTDC sent for this customer code, and that the Test/Live switch matches where it was issued.',
        }
      }
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not verify the DTDC API key.',
      }
    }
  }
}

const fields: ProviderField[] = [
  { key: 'apiKey', label: 'API key', secret: true, required: true },
  { key: 'customerCode', label: 'Customer code', required: true },
  { key: 'originPincode', label: 'Origin PIN code', required: true },
  {
    key: 'serviceType',
    label: 'Service type',
    help: `DTDC's service type id. Blank books ${DTDC_DEFAULT_SERVICE}.`,
  },
  { key: 'trackingUsername', label: 'Tracking username' },
  { key: 'trackingPassword', label: 'Tracking password', secret: true },
  {
    key: 'baseUrl',
    label: 'API base URL',
    help: `Leave blank for production. Demo: ${DTDC_DEMO_URL}`,
  },
]

export const dtdcFactory: ShippingProviderFactory<DtdcConfig> = {
  id: 'dtdc',
  label: 'DTDC',
  fields,
  capabilities: DTDC_CAPABILITIES,
  serviceabilityWithoutCredentials: true,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    if (!r.apiKey?.trim()) errors.push('API key is required')
    if (!r.customerCode?.trim()) errors.push('customer code is required')
    if (!isValidPincode(r.originPincode?.trim())) errors.push('origin PIN code must be 6 digits')
    if (Boolean(r.trackingUsername?.trim()) !== Boolean(r.trackingPassword?.trim())) {
      errors.push('tracking needs both the username and the password')
    }
    const baseUrlProblem = courierBaseUrlProblem(r.baseUrl, ['shipsy.io', 'shipsy.in'])
    if (baseUrlProblem) errors.push(baseUrlProblem)
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        apiKey: (r.apiKey as string).trim(),
        customerCode: (r.customerCode as string).trim(),
        originPincode: (r.originPincode as string).trim(),
        serviceType: r.serviceType?.trim() || undefined,
        trackingUsername: r.trackingUsername?.trim() || undefined,
        trackingPassword: r.trackingPassword?.trim() || undefined,
        baseUrl: r.baseUrl?.trim() || undefined,
      },
    }
  },
  create: (config) => new DtdcProvider(config),
}
