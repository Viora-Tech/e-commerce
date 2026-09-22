'use client'

import type { PaymentAdjustment } from '@commerce/core'
import PaymentAdjustmentFields from '@/components/settings/payment-adjustment-fields'
import ProviderSettingsForm, {
  type ProviderDef,
} from '@/components/settings/provider-settings-form'
import { paymentsSettingsContent as copy } from '@/data/payments'
import { settingsContent } from '@/data/settings'
import { api } from '@/lib/api-client'

type Extra = { adjustments: Record<string, PaymentAdjustment> }

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

const load = () => api.store.getPayments()
const save = (next: Parameters<typeof api.store.updatePayments>[0]) =>
  api.store.updatePayments(next)

function webhookHint(m: ProviderDef) {
  if (m.id !== 'razorpay') return null
  return (
    <p className="text-caption text-muted-foreground">
      {copy.webhookHint}{' '}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
        {`${WORKER_URL}/webhooks/payments/razorpay/<store id>`}
      </code>
    </p>
  )
}

function adjustmentFields(m: ProviderDef, extra: Extra, setExtra: (next: Extra) => void) {
  const setAdjustment = (adj: PaymentAdjustment | undefined) => {
    const { [m.id]: _drop, ...rest } = extra.adjustments
    setExtra({ adjustments: adj ? { ...rest, [m.id]: adj } : rest })
  }

  return (
    <PaymentAdjustmentFields
      providerId={m.id}
      value={extra.adjustments[m.id]}
      onChange={setAdjustment}
    />
  )
}

export default function PaymentsSettings() {
  return (
    <ProviderSettingsForm<Extra>
      title={copy.title}
      intro={copy.intro}
      load={load}
      save={save}
      emptyExtra={{ adjustments: {} }}
      renderHint={webhookHint}
      renderExtra={adjustmentFields}
      sections={settingsContent.sections.payments}
      extraSectionId={settingsContent.sections.payments[1]?.id}
    />
  )
}
