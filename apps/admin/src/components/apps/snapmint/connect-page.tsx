'use client'

import { CreditCard } from '@commerce/ui/icons'
import { useEffect, useState } from 'react'
import ConnectFields, { type ConnectFieldSpec } from '@/components/apps/shared/connect-fields'
import type { ModeSwitch } from '@/components/apps/shared/connect-mode-switch'
import ProviderConnectPage, {
  type ConnectContext,
  type TestOutcome,
} from '@/components/apps/shared/provider-connect-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { snapmintAppContent } from '@/data/snapmint'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ConnectGuide from './connect-guide'
import ConnectSetupFields from './connect-setup-fields'

type Ctx = ConnectContext<TestOutcome>

const PROVIDER_ID = 'snapmint'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

const emptyValues: FieldValues = {
  merchantId: '',
  merchantKey: '',
  merchantToken: '',
  mode: 'test',
}

const filled = (v: string | undefined) => (v ?? '').trim().length > 0

const keysFilled = (values: FieldValues) =>
  filled(values.merchantId) && filled(values.merchantKey) && filled(values.merchantToken)

/** Read-only: Snapmint's order status for an order that cannot exist (the token is checked). */
const testConnection = (values: FieldValues) =>
  api.payments.testConnection({
    providerId: PROVIDER_ID,
    fields: values,
    mode: values.mode === 'live' ? 'live' : 'test',
  })

/** The Snapmint app's details screen: a 3-step guide, Sandbox/Live, a read-only "Test
 *  connection", and what Snapmint must set up (the payment updates URL, our server IPs). */
export default function ConnectPage() {
  // Hooks
  const { connect: copy } = useCopy(snapmintAppContent)
  const [storeId, setStoreId] = useState<string | null>(null)

  useEffect(() => {
    api.store.current().then((s) => setStoreId(s?.id ?? null))
  }, [])

  // Helpers
  const renderGuide = ({ values, savedValues, enabled, testStatus, opened, onOpen }: Ctx) => (
    <ConnectGuide
      step1Done={opened || filled(values.merchantId)}
      step2Done={enabled && filled(savedValues.merchantId)}
      step3Done={keysFilled(values) && testStatus === 'ok'}
      onOpenSignup={onOpen}
    />
  )

  const renderFields = ({ values, setField }: Ctx) => (
    <ConnectFields providerId={PROVIDER_ID} specs={fieldSpecs} values={values} onField={setField} />
  )

  const renderExtras = () => (
    <ConnectSetupFields
      webhookUrl={`${WORKER_URL}/webhooks/payments/${PROVIDER_ID}/${storeId ?? '<store id>'}`}
    />
  )

  // Render logic
  const fieldSpecs: ConnectFieldSpec[] = [
    { key: 'merchantId', inputMode: 'numeric', ...copy.fields.merchantId },
    { key: 'merchantKey', type: 'password', ...copy.fields.merchantKey },
    { key: 'merchantToken', type: 'password', ...copy.fields.merchantToken },
  ]
  const mode: ModeSwitch = {
    read: (values) => (values.mode === 'live' ? 'live' : 'test'),
    write: (next, setField) => setField('mode', next),
    copy: copy.mode,
    keySets: true,
  }

  return (
    <ProviderConnectPage
      providerId={PROVIDER_ID}
      kind="payments"
      icon={<CreditCard aria-hidden="true" />}
      copy={{ ...copy, saveFailedTitle: copy.saveFailed }}
      emptyValues={emptyValues}
      test={testConnection}
      canTest={keysFilled}
      mode={mode}
      guide={renderGuide}
      fields={renderFields}
      extras={renderExtras}
    />
  )
}
