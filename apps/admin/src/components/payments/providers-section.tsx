'use client'

import { Plus, SlidersHorizontal } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import StatusChip from '@/components/layout/status-chip'
import { useDrillNav } from '@/components/settings/settings-drill'
import SettingsLinkRow from '@/components/settings/settings-link-row'
import { paymentProvidersContent } from '@/data/payment-providers'
import {
  gatewayCatalogue,
  type MethodId,
  methodNames,
  paymentsSetupContent,
} from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import GatewayLogo from './gateway-logo'
import { PAYMENT_ROWS } from './payments-rows'
import PaymentsSection from './payments-section'
import { listedProviders, mainProviderId, providerStatus } from './provider-status'
import ProviderStatusChip from './provider-status-chip'
import type { PaymentsSetup } from './types'

type ProvidersSectionProps = {
  setup: PaymentsSetup
  /** Shows the "Checkout order" row: two or more providers to choose between. */
  showOrder: boolean
  onAdd: () => void
  /** Reopens the step-by-step guide; offered while nothing is connected. */
  onOpenGuide: () => void
}

/** Method marks shown on a row before "+N". */
const MAX_MARKS = 3

const monogramOf = (id: string) =>
  gatewayCatalogue.find((g) => g.id === id)?.monogram ?? id.slice(0, 2)

/**
 * "Payment providers": one row per connected gateway (logo, name, status, the ways to pay it
 * takes), each opening the provider's own page; "+ Add provider" opens the gateway list.
 */
export default function ProvidersSection({
  setup,
  showOrder,
  onAdd,
  onOpenGuide,
}: ProvidersSectionProps) {
  // Hooks
  const { overview } = useCopy(paymentProvidersContent)
  const { openGuide } = useCopy(paymentsSetupContent)
  const names = useCopy(methodNames)
  const open = useDrillNav()

  // Helpers
  const marksOf = (methods: string[]) =>
    methods.flatMap((m) => (m in names ? [names[m as MethodId].name] : []))

  // Render logic
  const copy = overview.providers
  const providers = listedProviders(setup)
  const mainId = providers.length > 1 ? mainProviderId(setup) : null
  const action = (
    <Button variant="outline" className="gap-1.5" onClick={onAdd}>
      <Plus aria-hidden="true" className="size-4" />
      {copy.add}
    </Button>
  )
  const empty = providers.length ? undefined : (
    <div className="flex flex-col items-start gap-3 px-5 py-5 sm:flex-row sm:items-center">
      <div className="flex flex-1 flex-col gap-0.5">
        <p className="text-body font-semibold text-ink-strong">{copy.empty}</p>
        <p className="text-caption text-muted-foreground">{copy.emptyHelp}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={onOpenGuide}>
          {openGuide}
        </Button>
        <Button onClick={onAdd}>{copy.choose}</Button>
      </div>
    </div>
  )

  return (
    <PaymentsSection
      id="payments-providers-list"
      heading={copy.heading}
      description={copy.help}
      action={providers.length ? action : undefined}
      empty={empty}
    >
      {providers.map((g) => {
        const marks = marksOf(g.methods)
        return (
          <li key={g.id}>
            <SettingsLinkRow
              href={routes.settings.paymentProvider(g.id)}
              leading={<GatewayLogo id={g.id} monogram={monogramOf(g.id)} />}
              title={
                <>
                  {g.name}
                  <ProviderStatusChip status={providerStatus(g, setup)} />
                  {g.id === mainId ? <StatusChip tone="info">{copy.main}</StatusChip> : null}
                </>
              }
              value={
                marks.length ? (
                  <span className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                    {marks.slice(0, MAX_MARKS).map((m) => (
                      <MethodMark key={m} label={m} />
                    ))}
                    {marks.length > MAX_MARKS ? (
                      <MethodMark label={copy.more(marks.length - MAX_MARKS)} />
                    ) : null}
                  </span>
                ) : undefined
              }
            />
          </li>
        )
      })}
      {showOrder ? (
        <li>
          <SettingsLinkRow
            onClick={() => open(PAYMENT_ROWS.providers)}
            leading={<RowIcon />}
            title={copy.order}
            description={copy.orderHelp}
          />
        </li>
      ) : null}
    </PaymentsSection>
  )
}

type MethodMarkProps = {
  label: string
}

/** A small bordered mark for one way to pay ("UPI", "Cards"). */
function MethodMark({ label }: MethodMarkProps) {
  return (
    <span className="rounded-md border border-border bg-card px-1.5 py-0.5 text-caption font-medium text-foreground">
      {label}
    </span>
  )
}

/** The order row's icon tile, sized like a gateway logo. */
function RowIcon() {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground [&_svg]:size-4"
    >
      <SlidersHorizontal />
    </span>
  )
}
