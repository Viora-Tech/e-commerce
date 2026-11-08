'use client'

import type { PaymentAdjustment } from '@commerce/core'
import { CreditCard } from '@commerce/ui/icons'
import { useState } from 'react'
import UpiCompare from '@/components/payments/upi-compare'
import CheckoutRepeatFields from '@/components/settings/checkout-repeat-fields'
import ManualTransferFields from '@/components/settings/manual-transfer-fields'
import PaymentAdjustmentFields from '@/components/settings/payment-adjustment-fields'
import PreorderBalanceSettings from '@/components/settings/preorder-balance-settings'
import PreorderNoteSettings from '@/components/settings/preorder-note-settings'
import ProviderSettingsForm, {
  type LinkedSave,
  type ProviderDef,
} from '@/components/settings/provider-settings-form'
import SettingsSection from '@/components/settings/settings-section'
import UnpaidExpiryField from '@/components/settings/unpaid-expiry-field'
import { paymentsSettingsContent } from '@/data/payments'
import { PAYMENTS_PAGE_HREF, paymentsSetupContent } from '@/data/payments-setup'
import { settingsContent } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Extra = {
  adjustments: Record<string, PaymentAdjustment>
  /** Minutes before an unpaid online order is cancelled; 0 is never. */
  expireUnpaidAfterMinutes: number
  /** Auto-cancel for unpaid manual transfers: unset is never chosen (on, the default). */
  manualAutoCancel?: 'on' | 'off' | undefined
  /** Hours before an unpaid manual-transfer order is cancelled; 0 is the 6 hour default. */
  manualCancelAfterHours: number
  /** Same items within these hours count as the same order; 0 is off. */
  duplicateCheckoutHours: number
  /** Most unpaid checkouts per shopper in an hour; 0 is no cap. */
  unpaidCheckoutsPerHour: number
}

const DEFAULT_EXPIRY_MINUTES = 30
/** Core `PaymentSettingsSchema` defaults, shown while the settings load. */
const DEFAULT_DUPLICATE_HOURS = 24
const DEFAULT_UNPAID_PER_HOUR = 3

/** Methods that confirm through the Razorpay webhook. */
const RAZORPAY_WEBHOOK_METHODS = new Set(['razorpay', 'razorpay_upi'])

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

/**
 * Set up on the main Payments page (connect, "Shoppers can pay with", "Manual payment
 * methods"), so not repeated here.
 */
const MAIN_PAGE_METHODS = new Set(['razorpay', 'cashfree', 'cod', 'manual'])

const load = () =>
  api.store.getPayments().then((r) => ({
    ...r,
    available: r.available.filter((p) => !MAIN_PAGE_METHODS.has(p.id)),
  }))
const save = (next: Parameters<typeof api.store.updatePayments>[0]) =>
  api.store.updatePayments(next)

/** The plain-word helper line (and comparison) for the two UPI options. */
function upiDescription(upiCopy: typeof paymentsSetupContent.upiOptions, m: ProviderDef) {
  const upiHelp: Record<string, string> = {
    razorpay_upi: upiCopy.auto.help,
    manual: upiCopy.manual.help,
  }
  const help = upiHelp[m.id]
  if (!help) return null
  return (
    <p className="flex flex-wrap items-center gap-x-2">
      {help} <UpiCompare />
    </p>
  )
}

function webhookHint(copy: typeof paymentsSettingsContent, m: ProviderDef) {
  if (!RAZORPAY_WEBHOOK_METHODS.has(m.id)) return null
  return (
    <p className="text-caption text-muted-foreground">
      {m.id === 'razorpay_upi' ? copy.upiQrHint : copy.webhookHint}{' '}
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

type PreorderSaves = {
  onNote: (state: LinkedSave) => void
  onBalance: (state: LinkedSave) => void
}

function footer(
  sections: typeof settingsContent.sections.payments,
  extra: Extra,
  setExtra: (next: Extra) => void,
  preorder: PreorderSaves,
) {
  const [, unpaid, preorders] = sections
  return (
    <>
      <SettingsSection id={unpaid?.id ?? 'section-unpaid'} className="flex flex-col gap-4">
        <UnpaidExpiryField
          value={extra.expireUnpaidAfterMinutes}
          onChange={(expireUnpaidAfterMinutes) => setExtra({ ...extra, expireUnpaidAfterMinutes })}
        />
        <ManualTransferFields value={extra} onChange={(next) => setExtra({ ...extra, ...next })} />
        <CheckoutRepeatFields value={extra} onChange={(next) => setExtra({ ...extra, ...next })} />
      </SettingsSection>
      {/* Kept in store.preorder, but saved by the page's one Save and save bar (#94). */}
      <SettingsSection id={preorders?.id ?? 'section-preorders'} className="flex flex-col gap-4">
        <PreorderNoteSettings onSaveState={preorder.onNote} />
        <PreorderBalanceSettings onSaveState={preorder.onBalance} />
      </SettingsSection>
    </>
  )
}

export default function AdvancedPayments() {
  // Hooks
  const copy = useCopy(paymentsSettingsContent)
  const setupCopy = useCopy(paymentsSetupContent)
  const {
    sections: { payments: sections },
  } = useCopy(settingsContent)
  const [noteSave, setNoteSave] = useState<LinkedSave | null>(null)
  const [balanceSave, setBalanceSave] = useState<LinkedSave | null>(null)

  // Render logic
  /** Back to the main Payments page; `view=page` skips the first-time guide. */
  const back = { label: setupCopy.title, href: PAYMENTS_PAGE_HREF }

  return (
    <div className="flex flex-col gap-3">
      {/* One "‹ Payments": the form draws it from `back`. */}
      <ProviderSettingsForm<Extra>
        title={copy.advancedTitle}
        icon={<CreditCard aria-hidden="true" />}
        intro={copy.advancedIntro}
        load={load}
        save={save}
        emptyExtra={{
          adjustments: {},
          expireUnpaidAfterMinutes: DEFAULT_EXPIRY_MINUTES,
          manualCancelAfterHours: 0,
          duplicateCheckoutHours: DEFAULT_DUPLICATE_HOURS,
          unpaidCheckoutsPerHour: DEFAULT_UNPAID_PER_HOUR,
        }}
        renderHint={(m) => webhookHint(copy, m)}
        renderDescription={(m) => upiDescription(setupCopy.upiOptions, m)}
        back={back}
        renderExtra={adjustmentFields}
        renderFooter={(extra, setExtra) =>
          footer(sections, extra, setExtra, { onNote: setNoteSave, onBalance: setBalanceSave })
        }
        linked={[noteSave, balanceSave].filter((l): l is LinkedSave => l !== null)}
        sections={sections}
      />
    </div>
  )
}
