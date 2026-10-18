'use client'

import { Truck } from '@commerce/ui/icons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import ConnectFields, { type ConnectFieldSpec } from '@/components/apps/shared/connect-fields'
import CourierConnectAside from '@/components/apps/shared/courier-connect-aside'
import CourierConnectGuide from '@/components/apps/shared/courier-connect-guide'
import ProviderConnectPage, {
  type ConnectContext,
} from '@/components/apps/shared/provider-connect-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { courierConnectContent } from '@/data/courier-apps'
import { rapidshypAppContent as appCopy } from '@/data/rapidshyp'
import { api } from '@/lib/api-client'
import ConnectAdvancedFields from './connect-advanced-fields'

type TestResult = Awaited<ReturnType<typeof api.store.testRapidshypConnection>>
type Ctx = ConnectContext<TestResult>

const copy = appCopy.connect
const PROVIDER_ID = 'rapidshyp'

const pageCopy = { ...copy, ...courierConnectContent }

const emptyValues: FieldValues = {
  apiKey: '',
  storeName: '',
  pickupAddressName: '',
  originPincode: '',
  baseUrl: '',
}

const testConnection = (values: FieldValues) =>
  api.store.testRapidshypConnection({ fields: values })

/** The pickup locations the last passing test loaded from RapidShyp. */
const pickupLocationsOf = (passed: TestResult | null) =>
  passed?.ok ? (passed.pickupLocations ?? []) : []

const passedMessage = (message: string | undefined, passed: TestResult | null) =>
  pickupLocationsOf(passed).length > 0 ? `${message} ${copy.pickupLocationsFetched}` : message

const filled = (v: string | undefined) => (v ?? '').trim().length > 0

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
        filled(values.storeName) &&
        filled(values.pickupAddressName) &&
        /^\d{6}$/.test((values.originPincode ?? '').trim())
      }
    />
  )
}

const renderFields = ({ values, setField, lastPassed }: Ctx) => {
  const pickupLocations = pickupLocationsOf(lastPassed)
  const specs: ConnectFieldSpec[] = [
    { key: 'apiKey', ...copy.fields.apiKey },
    { key: 'storeName', ...copy.fields.storeName },
    {
      key: 'pickupAddressName',
      label: copy.fields.pickupAddressName.label,
      help:
        pickupLocations.length > 0
          ? copy.fields.pickupAddressName.helpWithLocations
          : copy.fields.pickupAddressName.help,
      control:
        pickupLocations.length > 0 ? (
          <Select
            value={values.pickupAddressName}
            onValueChange={(v) => setField('pickupAddressName', v ?? '')}
          >
            <SelectTrigger id="rapidshyp-pickupAddressName" size="lg" className="w-full">
              <SelectValue placeholder={copy.fields.pickupAddressName.label} />
            </SelectTrigger>
            <SelectContent>
              {pickupLocations.map((loc) => (
                <SelectItem key={loc.name} value={loc.name}>
                  {loc.name}
                  {loc.city ? ` — ${loc.city}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined,
    },
    { key: 'originPincode', inputMode: 'numeric', pincode: true, ...copy.fields.originPincode },
  ]
  return <ConnectFields providerId={PROVIDER_ID} specs={specs} values={values} onField={setField} />
}

const renderExtras = ({ values, setField, advancedOpen, onAdvancedOpenChange }: Ctx) => (
  <ConnectAdvancedFields
    baseUrl={values.baseUrl ?? ''}
    onField={setField}
    open={advancedOpen}
    onOpenChange={onAdvancedOpenChange}
  />
)

const renderAside = (ctx: Ctx) => (
  <CourierConnectAside providerId={PROVIDER_ID} ctx={ctx} pickupKey="pickupAddressName" />
)

/** `/apps/rapidshyp/connect`: a 3-step guide, a read-only "Test connection" check (which also
 *  loads the registered pickup locations), and the rarely-touched base URL under Advanced. */
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
      passedMessage={passedMessage}
      guide={renderGuide}
      fields={renderFields}
      extras={renderExtras}
      aside={renderAside}
    />
  )
}
