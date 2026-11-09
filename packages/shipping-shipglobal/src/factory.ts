import {
  isValidPincode,
  type ProviderField,
  type ShippingProviderFactory,
} from '@commerce/shipping'
import { SHIPGLOBAL_CAPABILITIES, SHIPGLOBAL_DEFAULT_SERVICE } from './client'
import { SERVICE_CODES, serviceOrDefault } from './mapping'
import { type ShipglobalConfig, ShipglobalProvider } from './shipglobal'

/** What the Connect page saves. The password is the only secret. */
const fields: ProviderField[] = [
  {
    key: 'username',
    label: 'API username',
    required: true,
    help: 'From ShipGlobal › Settings › API.',
  },
  { key: 'password', label: 'API password', secret: true, required: true },
  {
    key: 'addressNickname',
    label: 'Pickup address nickname',
    help: 'Optional. The nickname of a saved ShipGlobal pickup address; blank uses your default.',
  },
  {
    key: 'customerNickname',
    label: 'Customer nickname',
    help: 'Franchise accounts only, as ShipGlobal gave it.',
  },
  { key: 'originPincode', label: 'Origin PIN code', required: true },
  { key: 'originCity', label: 'Origin city', required: true },
  { key: 'iec', label: 'IEC (Importer-Exporter Code)', help: '10 characters, from DGFT.' },
  { key: 'iossNumber', label: 'IOSS number', help: 'For parcels to the EU, if you have one.' },
  {
    key: 'service',
    label: 'Service',
    help: `Booked when you pick none from the live rates. One of ${[...SERVICE_CODES].join(', ')}.`,
  },
]

const optional = (v: string | undefined) => v?.trim() || undefined

export const shipglobalFactory: ShippingProviderFactory<ShipglobalConfig> = {
  id: 'shipglobal',
  label: 'ShipGlobal',
  fields,
  capabilities: SHIPGLOBAL_CAPABILITIES,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    // `email` is the key a login saved before the vendor-API rewrite used.
    const username = (r.username ?? r.email)?.trim() ?? ''
    if (!username) errors.push('API username is required')
    if (!r.password) errors.push('API password is required')
    if (!isValidPincode(r.originPincode?.trim())) errors.push('origin PIN code must be 6 digits')
    if (!r.originCity?.trim()) errors.push('origin city is required')
    const iec = r.iec?.trim()
    if (iec && !/^[A-Z0-9]{10}$/i.test(iec)) errors.push('IEC must be 10 letters or digits')
    if (errors.length) return { ok: false, errors }
    const ioss = r.iossNumber?.trim()
    return {
      ok: true,
      config: {
        username,
        password: r.password as string,
        addressNickname: optional(r.addressNickname),
        customerNickname: optional(r.customerNickname),
        originPincode: (r.originPincode as string).trim(),
        originCity: (r.originCity as string).trim(),
        iec: iec ? iec.toUpperCase() : undefined,
        iossNumber: ioss ? ioss.toUpperCase() : undefined,
        service: r.service?.trim() ? serviceOrDefault(r.service) : SHIPGLOBAL_DEFAULT_SERVICE,
      },
    }
  },
  create: (config) => new ShipglobalProvider(config),
}
