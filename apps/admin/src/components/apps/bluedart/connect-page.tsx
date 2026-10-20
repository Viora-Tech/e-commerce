'use client'

import { BLUEDART_SANDBOX_URL } from '@commerce/shipping-bluedart/client'
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
import { bluedartAppContent } from '@/data/bluedart'
import { courierConnectContent } from '@/data/courier-apps'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ConnectAdvancedFields from './connect-advanced-fields'

type Ctx = ConnectContext<TestOutcome>
type Copy = typeof bluedartAppContent.connect

const PROVIDER_ID = 'bluedart'

const emptyValues: FieldValues = {
  clientId: '',
  clientSecret: '',
  loginId: '',
  licenceKey: '',
  customerCode: '',
  originArea: '',
  originPincode: '',
  baseUrl: '',
  surfaceMode: 'false',
  registerPickup: 'true',
  pickupAddress: '',
  pickupPhone: '',
}

/** The keys the merchant must type before the guide's step two and three count as done. */
const KEYS = ['clientId', 'clientSecret', 'loginId', 'licenceKey'] as const

const fieldSpecs = (copy: Copy): ConnectFieldSpec[] => [
  { key: 'clientId', ...copy.fields.clientId },
  { key: 'clientSecret', type: 'password', ...copy.fields.clientSecret },
  { key: 'loginId', ...copy.fields.loginId },
  { key: 'licenceKey', type: 'password', ...copy.fields.licenceKey },
  { key: 'customerCode', ...copy.fields.customerCode },
  { key: 'originArea', ...copy.fields.originArea },
  { key: 'originPincode', inputMode: 'numeric', pincode: true, ...copy.fields.originPincode },
]

/** Test points the base URL at Blue Dart's sandbox; Live clears it. */
const modeSwitch = (copy: Copy): ModeSwitch => ({
  read: (values) => ((values.baseUrl ?? '').trim() ? 'test' : 'live'),
  write: (next, setField) => setField('baseUrl', next === 'test' ? BLUEDART_SANDBOX_URL : ''),
  copy: copy.mode,
})

/** Through the install flow's generic courier check: the app's own factory, one read-only call. */
const testConnection = (values: FieldValues) =>
  api.apps.testConnection({ id: PROVIDER_ID, providerId: PROVIDER_ID, fields: values })

const filled = (v: string | undefined) => (v ?? '').trim().length > 0

/** `/apps/bluedart/connect`: a 3-step guide, a Test/Live switch, a read-only "Test connection"
 *  check, and the rarely-touched fields under Advanced. */
export default function ConnectPage() {
  // Hooks
  const { connect: copy } = useCopy(bluedartAppContent)
  const shared = useCopy(courierConnectContent)

  // Helpers
  const renderGuide = ({ values, opened, onOpen }: Ctx) => {
    const step2Done = KEYS.every((k) => filled(values[k]))
    return (
      <CourierConnectGuide
        copy={copy}
        openedDashboard={opened}
        onOpenDashboard={onOpen}
        step2Done={step2Done}
        step3Done={
          step2Done &&
          filled(values.customerCode) &&
          /^[A-Za-z]{3}$/.test((values.originArea ?? '').trim()) &&
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
      pickupKey="originArea"
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
