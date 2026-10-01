'use client'

import { Truck } from '@commerce/ui/icons'
import ConnectFields, { type ConnectFieldSpec } from '@/components/apps/shared/connect-fields'
import CourierConnectGuide from '@/components/apps/shared/courier-connect-guide'
import ProviderConnectPage, {
  type ConnectContext,
  type TestOutcome,
} from '@/components/apps/shared/provider-connect-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { courierConnectContent } from '@/data/courier-apps'
import { shiprocketAppContent as appCopy } from '@/data/shiprocket'
import { api } from '@/lib/api-client'
import ConnectAdvancedFields from './connect-advanced-fields'

type Ctx = ConnectContext<TestOutcome>

const copy = appCopy.connect
const PROVIDER_ID = 'shiprocket'

const pageCopy = { ...copy, ...courierConnectContent }

const emptyValues: FieldValues = {
  email: '',
  password: '',
  pickupLocationName: '',
  originPincode: '',
  baseUrl: '',
  webhookSecret: '',
}

const fieldSpecs: ConnectFieldSpec[] = [
  { key: 'email', type: 'email', ...copy.fields.email },
  { key: 'password', type: 'password', ...copy.fields.password },
  { key: 'pickupLocationName', ...copy.fields.pickupLocationName },
  { key: 'originPincode', inputMode: 'numeric', ...copy.fields.originPincode },
]

const testConnection = (values: FieldValues) =>
  api.store.testShiprocketConnection({ fields: values })

const filled = (v: string | undefined) => (v ?? '').trim().length > 0

const renderGuide = ({ values, opened, onOpen }: Ctx) => {
  const step2Done = filled(values.email) && filled(values.password)
  return (
    <CourierConnectGuide
      copy={copy}
      openedDashboard={opened}
      onOpenDashboard={onOpen}
      step2Done={step2Done}
      step3Done={
        step2Done &&
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
    webhookSecret={values.webhookSecret ?? ''}
    onField={setField}
    open={advancedOpen}
    onOpenChange={onAdvancedOpenChange}
  />
)

/** `/apps/shiprocket/connect`: a 3-step guide, a read-only "Test connection" check, and the
 *  rarely-touched fields under Advanced. */
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
      guide={renderGuide}
      fields={renderFields}
      extras={renderExtras}
    />
  )
}
