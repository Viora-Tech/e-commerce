'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { paymentRoutingContent } from '@/data/payment-routing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ManualMethodDialog from './manual-method-dialog'
import type { PaymentsSetup } from './types'

type ManualMethodsCardProps = {
  setup: PaymentsSetup
  /** Whether cash on delivery is on in "Shoppers can pay with". */
  codOn: boolean
  disabled: boolean
  onCodChange: (on: boolean) => void
  onReload: () => Promise<void>
}

type Kind = 'upi' | 'bank'

const KINDS: readonly Kind[] = ['upi', 'bank']

/**
 * "Manual payment methods" (audit #149): the shop's own UPI ID, bank transfer and cash on
 * delivery, each with an on/off switch. Orders paid these ways wait as pending payment until a
 * staff member marks them paid. UPI and bank open a dialog for their details and the shopper's
 * instructions; cash on delivery links to its rules.
 */
export default function ManualMethodsCard({
  setup,
  codOn,
  disabled,
  onCodChange,
  onReload,
}: ManualMethodsCardProps) {
  // Hooks
  const { manual: copy } = useCopy(paymentRoutingContent)
  const [editing, setEditing] = useState<Kind | null>(null)
  const [busy, setBusy] = useState<Kind | null>(null)

  // Event handlers
  const handleToggle = async (kind: Kind, on: boolean) => {
    const row = setup.manualMethods[kind]
    // Nothing to show the shopper yet: fill the details first.
    if (on && !row.ready) {
      setEditing(kind)
      return
    }
    setBusy(kind)
    try {
      await api.payments.saveManual({ kind, on, note: row.note, fields: {} })
      toast.success(copy.saved)
      await onReload()
    } catch {
      toast.error(copy.saveFailed)
    } finally {
      setBusy(null)
    }
  }

  const handleClose = (open: boolean) => {
    if (!open) setEditing(null)
  }

  return (
    <SettingsCard
      id="payments-manual"
      title={copy.heading}
      description={copy.help}
      bodyClassName="gap-0 divide-y divide-hairline"
    >
      {KINDS.map((kind) => {
        const row = setup.manualMethods[kind]
        return (
          <div key={kind} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-body font-semibold text-ink-strong">{copy[kind].title}</p>
              <p className="text-caption text-muted-foreground">{copy[kind].help}</p>
            </div>
            <StatusChip tone={row.on ? 'success' : 'neutral'}>
              {row.on ? copy.active : copy.off}
            </StatusChip>
            <Button variant="outline" size="sm" onClick={() => setEditing(kind)}>
              {row.ready ? copy.edit : copy.setUp}
            </Button>
            <Switch
              aria-label={copy.turnOn(copy[kind].title)}
              checked={row.on}
              disabled={disabled || busy !== null}
              onCheckedChange={(on) => handleToggle(kind, on)}
            />
          </div>
        )
      })}
      <div className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-body font-semibold text-ink-strong">{copy.cod.title}</p>
          <p className="text-caption text-muted-foreground">{copy.cod.help}</p>
        </div>
        <StatusChip tone={codOn ? 'success' : 'neutral'}>
          {codOn ? copy.active : copy.off}
        </StatusChip>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={routes.settings.checkout()} />}
        >
          {copy.cod.settings}
        </Button>
        <Switch
          aria-label={copy.turnOn(copy.cod.title)}
          checked={codOn}
          disabled={disabled}
          onCheckedChange={onCodChange}
        />
      </div>
      {editing ? (
        <ManualMethodDialog
          kind={editing}
          manual={setup.manualMethods}
          open
          onOpenChange={handleClose}
          onSaved={onReload}
        />
      ) : null}
    </SettingsCard>
  )
}
