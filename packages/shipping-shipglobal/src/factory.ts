import {
  isValidPincode,
  type ProviderField,
  type ShippingProviderFactory,
} from '@commerce/shipping'
import {
  SHIPGLOBAL_CAPABILITIES,
  SHIPGLOBAL_DEFAULT_SERVICE,
  type ShipglobalServiceCode,
} from './client'
import { SERVICE_CODES } from './mapping'
import { type ShipglobalConfig, ShipglobalProvider } from './shipglobal'

/** What the Connect page saves. The password is the only secret. */
const fields: ProviderField[] = [
  {
    key: 'email',
    label: 'API login (email)',
    required: true,
    help: 'From ShipGlobal › Settings › API.',
  },
  { key: 'password', label: 'API password', secret: true, required: true },
  {
    key: 'sellerNickname',
    label: 'Seller nickname',
    required: true,
    help: 'Your seller name on ShipGlobal, sent with every order.',
  },
  { key: 'originPincode', label: 'Origin PIN code', required: true },
  { key: 'originCity', label: 'Origin city', required: true },
  { key: 'iec', label: 'IEC (Importer-Exporter Code)', help: '10 characters, from DGFT.' },
  { key: 'iossNumber', label: 'IOSS number', help: 'For parcels to the EU, if you have one.' },
  {
    key: 'service',
    label: 'Service',
    help: `One of ${[...SERVICE_CODES].join(', ')}.`,
  },
]

export const shipglobalFactory: ShippingProviderFactory<ShipglobalConfig> = {
  id: 'shipglobal',
  label: 'ShipGlobal',
  fields,
  capabilities: SHIPGLOBAL_CAPABILITIES,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    const email = r.email?.trim() ?? ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push('a valid API login email is required')
    if (!r.password) errors.push('API password is required')
    if (!r.sellerNickname?.trim()) errors.push('seller nickname is required')
    if (!isValidPincode(r.originPincode?.trim())) errors.push('origin PIN code must be 6 digits')
    if (!r.originCity?.trim()) errors.push('origin city is required')
    const iec = r.iec?.trim()
    if (iec && !/^[A-Z0-9]{10}$/i.test(iec)) errors.push('IEC must be 10 letters or digits')
    const service = (r.service?.trim().toUpperCase() || SHIPGLOBAL_DEFAULT_SERVICE) as string
    if (!SERVICE_CODES.has(service))
      errors.push(`service must be one of ${[...SERVICE_CODES].join(', ')}`)
    if (errors.length) return { ok: false, errors }
    const ioss = r.iossNumber?.trim()
    return {
      ok: true,
      config: {
        email,
        password: r.password as string,
        sellerNickname: (r.sellerNickname as string).trim(),
        originPincode: (r.originPincode as string).trim(),
        originCity: (r.originCity as string).trim(),
        iec: iec ? iec.toUpperCase() : undefined,
        iossNumber: ioss ? ioss.toUpperCase() : undefined,
        service: service as ShipglobalServiceCode,
      },
    }
  },
  create: (config) => new ShipglobalProvider(config),
}
