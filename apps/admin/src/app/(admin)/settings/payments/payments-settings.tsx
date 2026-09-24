'use client'

import type { PaymentAdjustment } from '@commerce/core'
import { CreditCard } from '@commerce/ui/icons'
import PaymentAdjustmentFields from '@/components/settings/payment-adjustment-fields'
import PreorderBalanceSettings from '@/components/settings/preorder-balance-settings'
import ProviderSettingsForm, {
  type ProviderDef,
} from '@/components/settings/provider-settings-form'
import SettingsSection from '@/components/settings/settings-section'
import UnpaidExpiryField from '@/components/settings/unpaid-expiry-field'
import { paymentsSettingsContent as copy } from '@/data/payments'
import { settingsContent } from '@/data/settings'
import { api } from '@/lib/api-client'

type Extra = {
  adjustments: Record<string, PaymentAdjustment>
  /** Minutes before an unpaid online order is cancelled; 0 is never. */
  expireUnpaidAfterMinutes: number
}

const DEFAULT_EXPIRY_MINUTES = 30

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
    setExtra({ ...extra, adjustments: adj ? { ...rest, [m.id]: adj } : rest })
  }

  return (
    <PaymentAdjustmentFields
      providerId={m.id}
      value={extra.adjustments[m.id]}
      onChange={setAdjustment}
    />
  )
}

function footer(extra: Extra, setExtra: (next: Extra) => void) {
  const [, unpaid, preorders] = settingsContent.sections.payments
  return (
    <>
      <SettingsSection id={unpaid?.id ?? 'section-unpaid'}>
        <UnpaidExpiryField
          value={extra.expireUnpaidAfterMinutes}
          onChange={(expireUnpaidAfterMinutes) => setExtra({ ...extra, expireUnpaidAfterMinutes })}
        />
      </SettingsSection>
      {/* Saved on its own (store.preorder), not with the payment methods above. */}
      <SettingsSection id={preorders?.id ?? 'section-preorders'}>
        <PreorderBalanceSettings />
      </SettingsSection>
    </>
  )
}

export default function PaymentsSettings() {
  return (
    <ProviderSettingsForm<Extra>
      title={copy.title}
      icon={<CreditCard aria-hidden="true" />}
      intro={copy.intro}
      load={load}
      save={save}
      emptyExtra={{ adjustments: {}, expireUnpaidAfterMinutes: DEFAULT_EXPIRY_MINUTES }}
      renderHint={webhookHint}
      renderExtra={adjustmentFields}
      renderFooter={footer}
      sections={settingsContent.sections.payments}
    />
  )
}
