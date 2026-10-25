'use client'

import { Truck } from '@commerce/ui/icons'
import ConnectFields, { type ConnectFieldSpec } from '@/components/apps/shared/connect-fields'
import CourierConnectAside from '@/components/apps/shared/courier-connect-aside'
import CourierConnectGuide from '@/components/apps/shared/courier-connect-guide'
import ProviderConnectPage, {
  type ConnectContext,
  type TestOutcome,
} from '@/components/apps/shared/provider-connect-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { courierConnectContent } from '@/data/courier-apps'
import { indiaPostAppContent } from '@/data/india-post'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ConnectExtras from './connect-extras'

type Ctx = ConnectContext<TestOutcome>

const PROVIDER_ID = 'india-post'

const emptyValues: FieldValues = {
  originPincode: '',
  customerId: '',
  contractRates: 'false',
  codEnabled: 'false',
  codFeeRupees: '',
  dataGovApiKey: '',
  tariffOverride: '',
}

const testConnection = (values: FieldValues) =>
  api.apps.testConnection({ id: PROVIDER_ID, providerId: PROVIDER_ID, fields: values })

const pinOk = (v: string | undefined) => /^\d{6}$/.test((v ?? '').trim())

const renderExtras = ({ values, setField, advancedOpen, onAdvancedOpenChange }: Ctx) => (
  <ConnectExtras
    values={values}
    onField={setField}
    open={advancedOpen}
    onOpenChange={onAdvancedOpenChange}
  />
)

const renderAside = (ctx: Ctx) => <CourierConnectAside providerId={PROVIDER_ID} ctx={ctx} />

/** `/apps/india-post/connect`: the post office PIN code, an optional business account (contract
 *  rates, COD) and data.gov.in key, and the merchant's own rate card under "Your own rates". */
export default function ConnectPage() {
  // Hooks
  const copy = useCopy(indiaPostAppContent)
  const shared = useCopy(courierConnectContent)

  // Helpers
  /* Step two (a business account) is optional, so it counts as done once the PIN code is in. */
  const renderGuide = ({ values, opened, onOpen }: Ctx) => (
    <CourierConnectGuide
      copy={copy.connect}
      openedDashboard={opened || pinOk(values.originPincode)}
      onOpenDashboard={onOpen}
      step2Done={pinOk(values.originPincode)}
      step3Done={false}
    />
  )
  const renderFields = ({ values, setField }: Ctx) => {
    const fields = copy.connect.fields
    const specs: ConnectFieldSpec[] = [
      { key: 'originPincode', inputMode: 'numeric', pincode: true, ...fields.originPincode },
      { key: 'customerId', ...fields.customerId },
      { key: 'dataGovApiKey', type: 'password', ...fields.dataGovApiKey },
    ]
    return (
      <ConnectFields providerId={PROVIDER_ID} specs={specs} values={values} onField={setField} />
    )
  }

  return (
    <ProviderConnectPage
      providerId={PROVIDER_ID}
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={{ ...copy.connect, ...shared }}
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
