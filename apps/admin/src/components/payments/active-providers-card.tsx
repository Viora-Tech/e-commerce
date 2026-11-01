'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { Switch } from '@commerce/ui/shadcn/switch'
import { SortableList } from '@commerce/ui/sortable'
import { useState } from 'react'
import { toast } from 'sonner'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { paymentRoutingContent } from '@/data/payment-routing'
import { gatewayCatalogue, methodSortLabels } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import GatewayLogo from './gateway-logo'
import { isGatewayId, type PaymentsSetup, routesFor } from './types'

type ActiveProvidersCardProps = {
  setup: PaymentsSetup
  onReload: () => Promise<void>
}

type Row = PaymentsSetup['routing']['gateways'][number]

/** The gateway's own name ("Cashfree"), not its checkout label. */
const nameOf = (id: string): string => gatewayCatalogue.find((g) => g.id === id)?.name ?? id
const monogramOf = (id: string): string =>
  gatewayCatalogue.find((g) => g.id === id)?.monogram ?? id.slice(0, 1).toUpperCase()

/**
 * "Active providers" (audit #148/#150): every connected gateway with an on/off switch, dragged
 * into fallback order. The first one on is the main way to get paid; when a gateway cannot
 * open a payment, checkout tries the next one on that takes the same method.
 */
export default function ActiveProvidersCard({ setup, onReload }: ActiveProvidersCardProps) {
  // Hooks
  const { providers: copy } = useCopy(paymentRoutingContent)
  const sortLabels = useCopy(methodSortLabels)
  const [rows, setRows] = useState<Row[]>(setup.routing.gateways)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleToggle = (id: string, active: boolean) =>
    setRows((r) => r.map((g) => (g.id === id ? { ...g, active } : g)))

  const handleSave = async () => {
    setSaving(true)
    try {
      const order = rows
        .filter((g) => g.active)
        .map((g) => g.id)
        .filter(isGatewayId)
      await api.payments.saveRouting({ order, methods: routesFor(setup.routing.methods, order) })
      toast.success(copy.saved)
      await onReload()
    } catch {
      toast.error(copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const firstOn = rows.find((g) => g.active)?.id
  const changed = JSON.stringify(rows) !== JSON.stringify(setup.routing.gateways)
  const footer = (
    <Button onClick={handleSave} disabled={saving || !changed}>
      {saving ? <Spinner /> : null}
      {copy.save}
    </Button>
  )

  return (
    <SettingsCard
      id="payments-providers"
      title={copy.heading}
      description={copy.help}
      footer={footer}
    >
      <SortableList
        items={rows}
        onReorder={setRows}
        getTitle={(g) => nameOf(g.id)}
        labels={sortLabels}
        className="-my-3.5 flex flex-col divide-y divide-hairline"
        renderItem={(g, { handle }) => {
          const inputId = `provider-${g.id}`
          return (
            <div className={cn('flex items-center gap-3 py-3.5', !g.active && 'opacity-70')}>
              {handle}
              <GatewayLogo id={g.id} monogram={monogramOf(g.id)} />
              <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer flex-col">
                <span className="text-body font-semibold text-ink-strong">{nameOf(g.id)}</span>
                <span className="text-caption text-muted-foreground">
                  {g.active ? copy.on : copy.off}
                </span>
              </label>
              {g.id === firstOn ? <StatusChip tone="success">{copy.main}</StatusChip> : null}
              <Switch
                id={inputId}
                aria-label={copy.turnOn(nameOf(g.id))}
                checked={g.active}
                disabled={saving}
                onCheckedChange={(on) => handleToggle(g.id, on)}
              />
            </div>
          )
        }}
      />
      {firstOn ? null : <p className="text-caption text-destructive">{copy.noneOn}</p>}
    </SettingsCard>
  )
}
