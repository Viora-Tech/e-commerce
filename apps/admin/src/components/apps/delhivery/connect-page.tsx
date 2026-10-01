'use client'

import { DELHIVERY_STAGING_URL } from '@commerce/shipping-delhivery'
import { Truck } from '@commerce/ui/icons'
import ConnectFields, { type ConnectFieldSpec } from '@/components/apps/shared/connect-fields'
import type { ModeSwitch } from '@/components/apps/shared/connect-mode-switch'
import CourierConnectGuide from '@/components/apps/shared/courier-connect-guide'
import ProviderConnectPage, {
  type ConnectContext,
  type TestOutcome,
} from '@/components/apps/shared/provider-connect-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { courierConnectContent } from '@/data/courier-apps'
import { delhiveryAppContent as appCopy } from '@/data/delhivery'
import { api } from '@/lib/api-client'
import ConnectAdvancedFields from './connect-advanced-fields'

type Ctx = ConnectContext<TestOutcome>

const copy = appCopy.connect
const PROVIDER_ID = 'delhivery'

const pageCopy = { ...copy, ...courierConnectContent }

const emptyValues: FieldValues = {
  apiToken: '',
  clientName: '',
  pickupLocationName: '',
  originPincode: '',
  baseUrl: '',
  expressMode: 'false',
  webhookSecret: '',
}

const fieldSpecs: ConnectFieldSpec[] = [
  { key: 'apiToken', type: 'password', ...copy.fields.apiToken },
  { key: 'clientName', ...copy.fields.clientName },
  { key: 'pickupLocationName', ...copy.fields.pickupLocationName },
  { key: 'originPincode', inputMode: 'numeric', ...copy.fields.originPincode },
]

/** Test points the base URL at Delhivery's staging server; Live clears it. */
const mode: ModeSwitch = {
  read: (values) => ((values.baseUrl ?? '').trim() ? 'test' : 'live'),
  write: (next, setField) => setField('baseUrl', next === 'test' ? DELHIVERY_STAGING_URL : ''),
  copy: copy.mode,
}

const testConnection = (values: FieldValues) =>
  api.store.testDelhiveryConnection({ fields: values })

const filled = (v: string | undefined) => (v ?? '').trim().length > 0

const renderGuide = ({ values, opened, onOpen }: Ctx) => {
  const step2Done = filled(values.apiToken)
  return (
    <CourierConnectGuide
      copy={copy}
      openedDashboard={opened}
      onOpenDashboard={onOpen}
      step2Done={step2Done}
      step3Done={
        step2Done &&
        filled(values.clientName) &&
        filled(values.pickupLocationName) &&
        /^\d{6}$/.test((values.originPincode ?? '').trim())
      }
    />
  )
}

const renderFields = ({ values, setField }: Ctx) => (
  <ConnectFields providerId={PROVIDER_ID} specs={fieldSpecs} values={values} onField={setField} />
)

const renderExtras = ({ values, setField, advancedOpen, onAdvancedOpenChange }: Ctx) => (
  <ConnectAdvancedFields
    baseUrl={values.baseUrl ?? ''}
    expressMode={values.expressMode ?? 'false'}
    webhookSecret={values.webhookSecret ?? ''}
    onField={setField}
    open={advancedOpen}
    onOpenChange={onAdvancedOpenChange}
  />
)

/** `/apps/delhivery/connect`: a 3-step guide, a Test/Live switch, a read-only "Test connection"
 *  check, and the rarely-touched fields under Advanced. */
export default function ConnectPage() {
  return (
    <ProviderConnectPage
      providerId={PROVIDER_ID}
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={pageCopy}
      emptyValues={emptyValues}
      test={testConnection}
      waitForListing
      mode={mode}
      guide={renderGuide}
      fields={renderFields}
      extras={renderExtras}
    />
  )
}
