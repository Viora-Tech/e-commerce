'use client'

import {
  SHIPGLOBAL_DEFAULT_SERVICE,
  SHIPGLOBAL_SERVICES,
} from '@commerce/shipping-shipglobal/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import type { ConnectFieldSpec } from '@/components/apps/shared/connect-fields'
import ExportCourierConnectPage from '@/components/apps/shared/export-courier-connect-page'
import type { ConnectContext, TestOutcome } from '@/components/apps/shared/provider-connect-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { shipglobalAppContent } from '@/data/shipglobal'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

const PROVIDER_ID = 'shipglobal'

const testConnection = (values: FieldValues) =>
  api.store.testShipglobalConnection({ fields: values })

/** The saved service, or the default for an empty or old (Label API) value. */
const serviceValue = (values: FieldValues) => {
  const v = (values.service ?? '').trim().toLowerCase()
  return (
    SHIPGLOBAL_SERVICES.find((s) => s.code.toLowerCase() === v)?.code ?? SHIPGLOBAL_DEFAULT_SERVICE
  )
}

/** `/apps/shipglobal/connect`: guide, API username, export details, default service and a
 *  read-only check (a sample rate). No Test/Live switch: ShipGlobal publishes one host. */
export default function ConnectPage() {
  // Hooks
  const copy = useCopy(shipglobalAppContent)

  // Helpers
  const extraFields = ({ values, setField }: ConnectContext<TestOutcome>): ConnectFieldSpec[] => [
    { key: 'iossNumber', ...copy.connect.fields.iossNumber },
    { key: 'customerNickname', ...copy.connect.fields.customerNickname },
    {
      key: 'service',
      ...copy.connect.fields.service,
      control: (
        <Select value={serviceValue(values)} onValueChange={(v) => setField('service', v ?? '')}>
          <SelectTrigger id={`${PROVIDER_ID}-service`} size="lg" className="w-full">
            <SelectValue placeholder={copy.connect.fields.service.label} />
          </SelectTrigger>
          <SelectContent>
            {SHIPGLOBAL_SERVICES.map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ]

  return (
    <ExportCourierConnectPage
      providerId={PROVIDER_ID}
      copy={copy.connect}
      keyField="username"
      secretField="password"
      accountField="addressNickname"
      extraFields={extraFields}
      extraValues={{ iossNumber: '', customerNickname: '', service: SHIPGLOBAL_DEFAULT_SERVICE }}
      test={testConnection}
    />
  )
}
