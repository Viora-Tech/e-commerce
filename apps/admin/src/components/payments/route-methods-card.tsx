'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import SettingsCard from '@/components/settings/settings-card'
import { paymentRoutingContent } from '@/data/payment-routing'
import { gatewayCatalogue, type MethodId, methodNames } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  type CheckoutMethodRow,
  isGatewayId,
  type PaymentsSetup,
  type RoutedMethodId,
  routesFor,
} from './types'

type RouteMethodsCardProps = {
  setup: PaymentsSetup
  /** "Shoppers can pay with" as it stands, so a method switched off there shows as off here. */
  methods: CheckoutMethodRow[]
  onReload: () => Promise<void>
}

const ONLINE: readonly RoutedMethodId[] = ['upi', 'card', 'netbanking', 'wallet', 'emi']

const nameOf = (id: string): string => gatewayCatalogue.find((g) => g.id === id)?.name ?? id

/**
 * "Route methods" (audit #148): one row per online way to pay with the active gateway that takes
 * it. A gateway that cannot take a method is not offered for it. Shown once two or more
 * gateways are on together.
 */
export default function RouteMethodsCard({ setup, methods, onReload }: RouteMethodsCardProps) {
  // Hooks
  const { routes: copy } = useCopy(paymentRoutingContent)
  const names = useCopy(methodNames)
  const [routes, setRoutes] = useState<Record<string, string | null>>(setup.routing.methods)
  const [saving, setSaving] = useState(false)

  // Helpers
  const active = setup.routing.gateways.filter((g) => g.active).map((g) => g.id)
  const takers = (m: RoutedMethodId) =>
    active.filter((id) => setup.routing.supports[id]?.includes(m) ?? true)

  // Event handlers
  const handlePick = (m: RoutedMethodId, id: string | null) => {
    if (id) setRoutes((r) => ({ ...r, [m]: id }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.payments.saveRouting({
        order: active.filter(isGatewayId),
        methods: routesFor(routes, active),
      })
      toast.success(copy.saved)
      await onReload()
    } catch {
      toast.error(copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const changed = ONLINE.some((m) => routes[m] !== setup.routing.methods[m])
  const footer = (
    <Button onClick={handleSave} disabled={saving || !changed}>
      {saving ? <Spinner /> : null}
      {copy.save}
    </Button>
  )

  return (
    <SettingsCard
      id="payments-routes"
      title={copy.heading}
      description={copy.help}
      footer={footer}
      bodyClassName="gap-0 divide-y divide-hairline"
    >
      {ONLINE.map((m) => {
        const on = methods.some((row) => row.id === m && row.on)
        const options = takers(m)
        const items = Object.fromEntries(options.map((id) => [id, nameOf(id)]))
        const inputId = `route-${m}`
        return (
          <div key={m} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <label htmlFor={inputId} className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body font-semibold text-ink-strong">
                {names[m as MethodId].name}
              </span>
              {on ? null : (
                <span className="text-caption text-muted-foreground">{copy.offInMethods}</span>
              )}
            </label>
            {options.length ? (
              <Select
                items={items}
                value={routes[m] ?? options[0] ?? null}
                onValueChange={(id: string | null) => handlePick(m, id)}
                disabled={saving}
              >
                <SelectTrigger id={inputId} className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((id) => (
                    <SelectItem key={id} value={id}>
                      {nameOf(id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-caption text-muted-foreground">{copy.nobody}</span>
            )}
          </div>
        )
      })}
    </SettingsCard>
  )
}
