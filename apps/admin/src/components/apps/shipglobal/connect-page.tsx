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

/** "UPS" is booked for US parcels above 5 kg when USPS is picked, so it is not its own choice. */
const serviceValue = (values: FieldValues) => {
  const v = (values.service ?? '').trim().toUpperCase()
  return SHIPGLOBAL_SERVICES.some((s) => s.code === v)
    ? v
    : v === 'UPS'
      ? 'USPS'
      : SHIPGLOBAL_DEFAULT_SERVICE
}

/** `/apps/shipglobal/connect`: guide, API login, export details, service and a read-only check.
 *  No Test/Live switch (ShipGlobal publishes one host) and no pickup switch (no pickup call). */
export default function ConnectPage() {
  // Hooks
  const copy = useCopy(shipglobalAppContent)

  // Helpers
  const extraFields = ({ values, setField }: ConnectContext<TestOutcome>): ConnectFieldSpec[] => [
    { key: 'iossNumber', ...copy.connect.fields.iossNumber },
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
      keyField="email"
      secretField="password"
      accountField="sellerNickname"
      extraFields={extraFields}
      extraValues={{ iossNumber: '', service: SHIPGLOBAL_DEFAULT_SERVICE }}
      test={testConnection}
    />
  )
}
