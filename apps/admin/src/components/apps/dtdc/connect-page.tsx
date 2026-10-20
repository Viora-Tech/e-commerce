'use client'

import { DTDC_DEMO_URL } from '@commerce/shipping-dtdc/client'
import { Truck } from '@commerce/ui/icons'
import ConnectFields, { type ConnectFieldSpec } from '@/components/apps/shared/connect-fields'
import type { ModeSwitch } from '@/components/apps/shared/connect-mode-switch'
import CourierConnectAside from '@/components/apps/shared/courier-connect-aside'
import CourierConnectGuide from '@/components/apps/shared/courier-connect-guide'
import ProviderConnectPage, {
  type ConnectContext,
  type TestOutcome,
} from '@/components/apps/shared/provider-connect-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { courierConnectContent } from '@/data/courier-apps'
import { dtdcAppContent } from '@/data/dtdc'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ConnectAdvancedFields from './connect-advanced-fields'

type Ctx = ConnectContext<TestOutcome>
type Copy = typeof dtdcAppContent.connect

const PROVIDER_ID = 'dtdc'

const emptyValues: FieldValues = {
  apiKey: '',
  customerCode: '',
  originPincode: '',
  trackingUsername: '',
  trackingPassword: '',
  serviceType: '',
  baseUrl: '',
}

const fieldSpecs = (copy: Copy): ConnectFieldSpec[] => [
  { key: 'apiKey', type: 'password', ...copy.fields.apiKey },
  { key: 'customerCode', ...copy.fields.customerCode },
  { key: 'originPincode', inputMode: 'numeric', pincode: true, ...copy.fields.originPincode },
  { key: 'trackingUsername', ...copy.fields.trackingUsername },
  { key: 'trackingPassword', type: 'password', ...copy.fields.trackingPassword },
]

/** Test points the base URL at DTDC's demo server; Live clears it. */
const modeSwitch = (copy: Copy): ModeSwitch => ({
  read: (values) => ((values.baseUrl ?? '').trim() ? 'test' : 'live'),
  write: (next, setField) => setField('baseUrl', next === 'test' ? DTDC_DEMO_URL : ''),
  copy: copy.mode,
})

/** Through the install flow's generic courier check, which also proves the key for DTDC
 *  (its PIN code lookup is public, see `serviceabilityWithoutCredentials`). */
const testConnection = (values: FieldValues) =>
  api.apps.testConnection({ id: PROVIDER_ID, providerId: PROVIDER_ID, fields: values })

const filled = (v: string | undefined) => (v ?? '').trim().length > 0

/** `/apps/dtdc/connect`: a 3-step guide, a Test/Live switch, a read-only "Test connection"
 *  check, and the rarely-touched fields under Advanced. */
export default function ConnectPage() {
  // Hooks
  const { connect: copy } = useCopy(dtdcAppContent)
  const shared = useCopy(courierConnectContent)

  // Helpers
  const renderGuide = ({ values, opened, onOpen }: Ctx) => {
    const step2Done = filled(values.apiKey)
    return (
      <CourierConnectGuide
        copy={copy}
        openedDashboard={opened}
        onOpenDashboard={onOpen}
        step2Done={step2Done}
        step3Done={
          step2Done &&
          filled(values.customerCode) &&
          /^\d{6}$/.test((values.originPincode ?? '').trim())
        }
      />
    )
  }

  const renderFields = ({ values, setField }: Ctx) => (
    <ConnectFields
      providerId={PROVIDER_ID}
      specs={fieldSpecs(copy)}
      values={values}
      onField={setField}
    />
  )

  const renderExtras = ({ values, setField, advancedOpen, onAdvancedOpenChange }: Ctx) => (
    <ConnectAdvancedFields
      values={values}
      onField={setField}
      open={advancedOpen}
      onOpenChange={onAdvancedOpenChange}
    />
  )

  const renderAside = (ctx: Ctx) => (
    <CourierConnectAside
      providerId={PROVIDER_ID}
      ctx={ctx}
      pickupKey="pickupLocation"
      mode={modeSwitch(copy)}
    />
  )

  // Render logic
  const pageCopy = { ...copy, ...shared }

  return (
    <ProviderConnectPage
      providerId={PROVIDER_ID}
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={pageCopy}
      emptyValues={emptyValues}
      test={testConnection}
      waitForListing
      mode={modeSwitch(copy)}
      guide={renderGuide}
      fields={renderFields}
      extras={renderExtras}
      aside={renderAside}
    />
  )
}
