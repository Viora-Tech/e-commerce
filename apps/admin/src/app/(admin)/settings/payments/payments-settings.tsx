'use client'

import type { PaymentAdjustment } from '@commerce/core'
import { Divider, Text } from '@shopify/polaris'
import { PaymentAdjustmentFields } from '@/components/settings/payment-adjustment-fields'
import {
  type ProviderDef,
  ProviderSettingsForm,
} from '@/components/settings/provider-settings-form'
import { paymentsSettingsContent as copy } from '@/data/payments'
import { api } from '@/lib/api-client'

type Extra = { adjustments: Record<string, PaymentAdjustment> }

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

const load = () => api.store.getPayments()
const save = (next: Parameters<typeof api.store.updatePayments>[0]) =>
  api.store.updatePayments(next)

function webhookHint(m: ProviderDef) {
  if (m.id !== 'razorpay') return null
  return (
    <Text as="p" tone="subdued" variant="bodySm">
      {copy.webhookHint} <code>{`${WORKER_URL}/webhooks/payments/razorpay/<store id>`}</code>
    </Text>
  )
}

function adjustmentFields(m: ProviderDef, extra: Extra, setExtra: (next: Extra) => void) {
  const setAdjustment = (adj: PaymentAdjustment | undefined) => {
    const { [m.id]: _drop, ...rest } = extra.adjustments
    setExtra({ adjustments: adj ? { ...rest, [m.id]: adj } : rest })
  }
  return (
    <>
      <Divider />
      <PaymentAdjustmentFields value={extra.adjustments[m.id]} onChange={setAdjustment} />
    </>
  )
}

export function PaymentsSettings() {
  return (
    <ProviderSettingsForm<Extra>
      title={copy.title}
      load={load}
      save={save}
      emptyExtra={{ adjustments: {} }}
      renderHint={webhookHint}
      renderExtra={adjustmentFields}
    />
  )
}
