'use client'

import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import { toast } from 'sonner'
import SettingsCard from '@/components/settings/settings-card'
import { paymentProvidersContent } from '@/data/payment-providers'
import { gatewayCatalogue, type MethodId, methodNames } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import type { CheckoutMethodRow, GatewayApp, PaymentsSetup } from './types'

type ProviderMethodsCardProps = {
  setup: PaymentsSetup
  gateway: GatewayApp
  onReload: () => Promise<void>
}

const nameOf = (id: string): string => gatewayCatalogue.find((g) => g.id === id)?.name ?? id

/**
 * A provider page's "Payment methods": each way to pay the provider takes with its checkout
 * switch (the same switch as "Supported methods", so it applies to every provider), and which
 * provider takes it when several are on.
 */
export default function ProviderMethodsCard({
  setup,
  gateway,
  onReload,
}: ProviderMethodsCardProps) {
  // Hooks
  const {
    provider: { methods: copy },
  } = useCopy(paymentProvidersContent)
  const names = useCopy(methodNames)
  const announceSetup = useSetupNext()
  const [methods, setMethods] = useState<CheckoutMethodRow[]>(setup.methods)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleToggle = async (id: string, on: boolean) => {
    const before = methods
    const next = methods.map((m) => (m.id === id ? { ...m, on } : m))
    setMethods(next)
    setSaving(true)
    try {
      await api.payments.saveMethods({ methods: next })
      toast.success(copy.saved)
      void announceSetup('payments')
      await onReload()
    } catch {
      setMethods(before)
      toast.error(copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const rows = methods.filter((m) => m.id !== 'cod' && gateway.methods.includes(m.id))
  const several = setup.routing.gateways.filter((g) => g.active).length > 1

  return (
    <SettingsCard
      id="provider-methods"
      title={copy.heading}
      description={copy.help(gateway.name)}
      bodyClassName="gap-0 divide-y divide-hairline"
    >
      {rows.length ? null : <p className="text-body text-muted-foreground">{copy.none}</p>}
      {rows.map((m) => {
        const name = names[m.id as MethodId]?.name ?? m.id
        const routed = several
          ? (setup.routing.methods as Record<string, string | null>)[m.id]
          : null
        const inputId = `provider-method-${m.id}`
        return (
          <div key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <label
              htmlFor={inputId}
              className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5"
            >
              <span className="text-body font-semibold text-ink-strong">{name}</span>
              <span className="text-caption text-muted-foreground">
                {routed && routed !== gateway.id
                  ? copy.routedTo(nameOf(routed))
                  : names[m.id as MethodId]?.help}
              </span>
            </label>
            <Switch
              id={inputId}
              aria-label={copy.turnOn(name)}
              checked={m.on}
              disabled={saving}
              onCheckedChange={(on) => handleToggle(m.id, on)}
            />
          </div>
        )
      })}
    </SettingsCard>
  )
}
