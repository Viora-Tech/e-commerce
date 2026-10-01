'use client'

import { CreditCard } from '@commerce/ui/icons'
import { useEffect, useState } from 'react'
import ConnectFields, { type ConnectFieldSpec } from '@/components/apps/shared/connect-fields'
import type { ModeSwitch } from '@/components/apps/shared/connect-mode-switch'
import ProviderConnectPage, {
  type ConnectContext,
  type ConnectPageCopy,
  type TestOutcome,
} from '@/components/apps/shared/provider-connect-page'
import { type FieldValues, setTestedFlag } from '@/components/apps/shared/provider-settings'
import { decentroAppContent as appCopy } from '@/data/decentro'
import { api } from '@/lib/api-client'
import ConnectAdvancedFields from './connect-advanced-fields'
import ConnectCallbackFields from './connect-callback-fields'
import ConnectGuide from './connect-guide'

type Ctx = ConnectContext<TestOutcome>

const copy = appCopy.connect
const PROVIDER_ID = 'decentro'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

const pageCopy: ConnectPageCopy = { ...copy, saveFailedTitle: copy.saveFailed }

const emptyValues: FieldValues = {
  clientId: '',
  clientSecret: '',
  consumerUrn: '',
  mode: 'test',
  webhookSecret: '',
  payoutConsumerUrn: '',
}

const fieldSpecs: ConnectFieldSpec[] = [
  { key: 'clientId', ...copy.fields.clientId },
  { key: 'clientSecret', type: 'password', ...copy.fields.clientSecret },
  { key: 'consumerUrn', ...copy.fields.consumerUrn },
]

/** The callback secret and the payouts code don't affect "Test connection". */
const KEEP_TEST_ON = ['payoutConsumerUrn', 'webhookSecret']

const mode: ModeSwitch = {
  read: (values) => (values.mode === 'live' ? 'live' : 'test'),
  write: (next, setField) => setField('mode', next),
  copy: copy.mode,
}

/** Letters and digits only: Decentro refuses special characters in callback header values. */
function newSecret(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** A first visit gets a callback secret ready to copy; it is saved with the keys. */
const prepare = (stored: FieldValues) =>
  stored.webhookSecret ? stored : { ...stored, webhookSecret: newSecret() }

const filled = (v: string | undefined) => (v ?? '').trim().length > 0

const keysFilled = (values: FieldValues) =>
  filled(values.clientId) && filled(values.clientSecret) && filled(values.consumerUrn)

/** A failed re-test also drops the Overview's "tested" badge. */
const testConnection = async (values: FieldValues) => {
  const result = await api.store.testDecentroConnection({ fields: values })
  if (!result.ok) setTestedFlag(PROVIDER_ID, false)
  return result
}

const renderGuide = ({ values, savedValues, enabled, testStatus, opened, onOpen }: Ctx) => (
  <ConnectGuide
    step1Done={opened || filled(values.clientId)}
    step2Done={keysFilled(values) && testStatus === 'ok'}
    step3Done={enabled && filled(savedValues.clientId) && filled(savedValues.webhookSecret)}
    onOpenSignup={onOpen}
  />
)

const renderFields = ({ values, setField }: Ctx) => (
  <ConnectFields providerId={PROVIDER_ID} specs={fieldSpecs} values={values} onField={setField} />
)

/** The Decentro app's credentials screen: a 3-step guide, Test/Live, a read-only
 *  "Test connection", the payment updates (callback) settings, and payouts under Advanced. */
export default function ConnectPage() {
  // Hooks
  const [storeId, setStoreId] = useState<string | null>(null)

  useEffect(() => {
    api.store.current().then((s) => setStoreId(s?.id ?? null))
  }, [])

  // Helpers
  const renderExtras = ({ values, setField, advancedOpen, onAdvancedOpenChange }: Ctx) => (
    <>
      <ConnectCallbackFields
        webhookSecret={values.webhookSecret ?? ''}
        webhookUrl={`${WORKER_URL}/webhooks/payments/${PROVIDER_ID}/${storeId ?? '<store id>'}`}
        onNewSecret={() => setField('webhookSecret', newSecret())}
      />
      <ConnectAdvancedFields
        payoutConsumerUrn={values.payoutConsumerUrn ?? ''}
        onField={setField}
        open={advancedOpen}
        onOpenChange={onAdvancedOpenChange}
      />
    </>
  )

  return (
    <ProviderConnectPage
      providerId={PROVIDER_ID}
      kind="payments"
      icon={<CreditCard aria-hidden="true" />}
      copy={pageCopy}
      emptyValues={emptyValues}
      test={testConnection}
      prepare={prepare}
      keepTestOn={KEEP_TEST_ON}
      canTest={keysFilled}
      mode={mode}
      guide={renderGuide}
      fields={renderFields}
      extras={renderExtras}
    />
  )
}
