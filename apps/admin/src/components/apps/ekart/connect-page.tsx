'use client'

import { Truck } from '@commerce/ui/icons'
import ConnectFields, { type ConnectFieldSpec } from '@/components/apps/shared/connect-fields'
import CourierAdvancedFields from '@/components/apps/shared/courier-advanced-fields'
import CourierConnectAside from '@/components/apps/shared/courier-connect-aside'
import CourierConnectGuide from '@/components/apps/shared/courier-connect-guide'
import ProviderConnectPage, {
  type ConnectContext,
  type TestOutcome,
} from '@/components/apps/shared/provider-connect-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { courierConnectContent } from '@/data/courier-apps'
import { ekartAppContent } from '@/data/ekart'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Ctx = ConnectContext<TestOutcome>

const PROVIDER_ID = 'ekart'

const emptyValues: FieldValues = {
  clientId: '',
  username: '',
  password: '',
  originPincode: '',
  pickupAlias: '',
  sellerName: '',
  sellerAddress: '',
  sellerGstin: '',
  baseUrl: '',
  webhookSecret: '',
}

const testConnection = (values: FieldValues) => api.store.testEkartConnection({ fields: values })

const filled = (v: string | undefined) => (v ?? '').trim().length > 0

const renderAside = (ctx: Ctx) => (
  <CourierConnectAside providerId={PROVIDER_ID} ctx={ctx} pickupKey="pickupAlias" />
)

/** `/apps/ekart/connect`: a 3-step guide, a read-only "Test connection" check, and the
 *  base URL and webhook secret under Advanced. */
export default function ConnectPage() {
  // Hooks
  const { connect: copy } = useCopy(ekartAppContent)
  const saveCopy = useCopy(courierConnectContent)

  // Helpers
  const renderGuide = ({ values, opened, onOpen }: Ctx) => {
    const step2Done = filled(values.clientId) && filled(values.username) && filled(values.password)
    return (
      <CourierConnectGuide
        copy={copy}
        openedDashboard={opened}
        onOpenDashboard={onOpen}
        step2Done={step2Done}
        step3Done={
          step2Done &&
          filled(values.sellerName) &&
          filled(values.sellerAddress) &&
          /^\d{6}$/.test((values.originPincode ?? '').trim())
        }
      />
    )
  }

  const renderFields = ({ values, setField }: Ctx) => {
    const specs: ConnectFieldSpec[] = [
      { key: 'clientId', ...copy.fields.clientId },
      { key: 'username', ...copy.fields.username },
      { key: 'password', type: 'password', ...copy.fields.password },
      { key: 'originPincode', inputMode: 'numeric', pincode: true, ...copy.fields.originPincode },
      { key: 'pickupAlias', ...copy.fields.pickupAlias },
      { key: 'sellerName', ...copy.fields.sellerName },
      { key: 'sellerAddress', ...copy.fields.sellerAddress },
      { key: 'sellerGstin', ...copy.fields.sellerGstin },
    ]
    return (
      <ConnectFields providerId={PROVIDER_ID} specs={specs} values={values} onField={setField} />
    )
  }

  const renderExtras = ({ values, setField, advancedOpen, onAdvancedOpenChange }: Ctx) => (
    <CourierAdvancedFields
      providerId={PROVIDER_ID}
      copy={copy.advanced}
      baseUrl={values.baseUrl ?? ''}
      webhookSecret={values.webhookSecret ?? ''}
      onField={setField}
      open={advancedOpen}
      onOpenChange={onAdvancedOpenChange}
    />
  )

  return (
    <ProviderConnectPage
      providerId={PROVIDER_ID}
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={{ ...copy, ...saveCopy }}
      emptyValues={emptyValues}
      test={testConnection}
      waitForListing
      guide={renderGuide}
      fields={renderFields}
      extras={renderExtras}
      aside={renderAside}
    />
  )
}
