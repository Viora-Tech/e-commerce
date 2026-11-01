'use client'

import { useState } from 'react'
import ActionMenu from '@/components/layout/action-menu'
import StatusChip from '@/components/layout/status-chip'
import { useDrillNav } from '@/components/settings/settings-drill'
import SettingsLinkRow from '@/components/settings/settings-link-row'
import { paymentProvidersContent } from '@/data/payment-providers'
import { paymentRoutingContent } from '@/data/payment-routing'
import { useCopy } from '@/hooks/use-copy'
import ManualMethodDialog from './manual-method-dialog'
import { PAYMENT_ROWS } from './payments-rows'
import PaymentsSection from './payments-section'
import type { PaymentsSetup } from './types'

type ManualSectionProps = {
  setup: PaymentsSetup
  /** Whether cash on delivery is on in "Shoppers can pay with". */
  codOn: boolean
  onReload: () => Promise<void>
}

type Kind = 'upi' | 'bank'

const KINDS: readonly Kind[] = ['upi', 'bank']

/**
 * "Manual payment methods": UPI ID, bank transfer and cash on delivery, each "Active" or
 * "Off". UPI and bank open their details dialog; cash on delivery opens the full manual
 * methods card, where its switch and rules are.
 */
export default function ManualSection({ setup, codOn, onReload }: ManualSectionProps) {
  // Hooks
  const { overview } = useCopy(paymentProvidersContent)
  const { manual: copy } = useCopy(paymentRoutingContent)
  const open = useDrillNav()
  const [editing, setEditing] = useState<Kind | null>(null)

  // Event handlers
  const handleClose = (next: boolean) => {
    if (!next) setEditing(null)
  }

  const handleOpenAll = () => open(PAYMENT_ROWS.manual)

  // Render logic
  const action = (
    <ActionMenu
      label={overview.manual.add}
      trigger="button"
      variant="outline"
      items={[
        ...KINDS.map((kind) => ({ label: copy[kind].title, onSelect: () => setEditing(kind) })),
        { label: copy.cod.title, onSelect: handleOpenAll },
        { label: overview.manual.all, onSelect: handleOpenAll, separatorBefore: true },
      ]}
    />
  )

  return (
    <>
      <PaymentsSection
        id="payments-manual-list"
        heading={overview.manual.heading}
        description={overview.manual.help}
        action={action}
      >
        {KINDS.map((kind) => (
          <li key={kind}>
            <SettingsLinkRow
              onClick={() => setEditing(kind)}
              title={copy[kind].title}
              value={
                <OnChip
                  on={setup.manualMethods[kind].on}
                  activeLabel={copy.active}
                  offLabel={copy.off}
                />
              }
            />
          </li>
        ))}
        <li>
          <SettingsLinkRow
            onClick={handleOpenAll}
            title={copy.cod.title}
            value={<OnChip on={codOn} activeLabel={copy.active} offLabel={copy.off} />}
          />
        </li>
      </PaymentsSection>
      {editing ? (
        <ManualMethodDialog
          kind={editing}
          manual={setup.manualMethods}
          open
          onOpenChange={handleClose}
          onSaved={onReload}
        />
      ) : null}
    </>
  )
}

type OnChipProps = {
  on: boolean
  activeLabel: string
  offLabel: string
}

/** "Active" in green or a quiet "Off". */
function OnChip({ on, activeLabel, offLabel }: OnChipProps) {
  return <StatusChip tone={on ? 'success' : 'neutral'}>{on ? activeLabel : offLabel}</StatusChip>
}
