'use client'

import { CircleCheck } from '@commerce/ui/icons'
import { toast } from 'sonner'
import SettingsCard from '@/components/settings/settings-card'
import { paymentProvidersContent } from '@/data/payment-providers'
import { gatewayCatalogue, paymentsSetupContent } from '@/data/payments-setup'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import GatewayProblem from './gateway-problem'
import type { GatewayApp, PaymentsSetup } from './types'

type ProviderAboutCardProps = {
  setup: PaymentsSetup
  gateway: GatewayApp
  onReload: () => Promise<void>
}

/**
 * "About <provider>": what it is and what it costs, how it is connected, its last payment, and
 * (for the main provider) whether it works, each problem with its one-click fix.
 */
export default function ProviderAboutCard({ setup, gateway, onReload }: ProviderAboutCardProps) {
  // Hooks
  const {
    provider: { about: copy },
  } = useCopy(paymentProvidersContent)
  const { main, methods: methodsCopy } = useCopy(paymentsSetupContent)
  const catalogue = useCopy(gatewayCatalogue)
  const fmt = useFormat()

  // Event handlers
  const handleTurnOnUpi = async () => {
    try {
      await api.payments.saveMethods({
        methods: setup.methods.map((m) => (m.id === 'upi' ? { ...m, on: true } : m)),
      })
      toast.success(methodsCopy.saved)
      await onReload()
    } catch {
      toast.error(methodsCopy.saveFailed)
    }
  }

  // Render logic
  const entry = catalogue.find((g) => g.id === gateway.id)
  // Health and payments are tracked for the main provider only.
  const status = setup.primary?.id === gateway.id ? setup.primary : null
  const healthy = status ? status.problems.length === 0 : null

  return (
    <SettingsCard title={copy.heading(gateway.name)} description={entry?.blurb}>
      <dl className="grid gap-4 text-body sm:grid-cols-3">
        {entry ? <Fact label={copy.fees} value={entry.fees} /> : null}
        <Fact
          label={copy.connection}
          value={status?.via === 'oauth' ? main.viaOauth : main.viaKeys}
        />
        {status ? (
          <Fact
            label={copy.lastPayment}
            value={
              status.lastPayment
                ? `${fmt.money(status.lastPayment.amountPaise)} · ${fmt.ago(status.lastPayment.at)}`
                : copy.noPaymentsYet
            }
          />
        ) : null}
      </dl>
      {healthy === true && gateway.connected ? (
        <p className="mt-4 flex items-center gap-1.5 text-caption font-medium text-success">
          <CircleCheck aria-hidden="true" className="size-3.5" />
          {main.working}
        </p>
      ) : null}
      {status && healthy === false ? (
        <ul className="mt-4 flex flex-col gap-2">
          {status.problems.map((p) => (
            <GatewayProblem
              key={p.code}
              problem={p}
              gatewayId={gateway.id}
              onFixed={onReload}
              onTurnOnUpi={handleTurnOnUpi}
            />
          ))}
        </ul>
      ) : null}
    </SettingsCard>
  )
}

type FactProps = {
  label: string
  value: string
}

/** One label over its value. */
function Fact({ label, value }: FactProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
