'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { gatewayCatalogue, paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import GatewayLogo from './gateway-logo'
import { isGatewayId, type PaymentsSetup } from './types'

type WizardHowStepProps = {
  gateways: PaymentsSetup['gateways']
  busy: string | null
  onPick: (id: string) => void
}

const optionClass =
  'flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'

/** Step 1: pick Razorpay, Cashfree, or cash on delivery only. */
export default function WizardHowStep({ gateways, busy, onPick }: WizardHowStepProps) {
  // Hooks
  const {
    wizard: { how: copy },
  } = useCopy(paymentsSetupContent)
  const catalogue = useCopy(gatewayCatalogue)

  // Render logic
  const shipped = new Set(gateways.map((g) => g.id))
  // The guide connects a main gateway; UPI-only apps (Decentro) are added from the page.
  const options = catalogue.filter((g) => g.available && shipped.has(g.id) && isGatewayId(g.id))

  return (
    <div className="flex flex-col gap-3">
      {options.map((g, i) => (
        <button
          key={g.id}
          type="button"
          className={optionClass}
          disabled={busy !== null}
          onClick={() => onPick(g.id)}
        >
          <GatewayLogo id={g.id} monogram={g.monogram} size="lg" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 text-body font-semibold text-foreground">
              {g.name}
              {i === 0 ? <Badge variant="info">{copy.recommended}</Badge> : null}
            </span>
            <span className="text-caption text-muted-foreground">{g.blurb}</span>
          </span>
          {busy === g.id ? <Spinner /> : null}
        </button>
      ))}
      <button
        type="button"
        className={optionClass}
        disabled={busy !== null}
        onClick={() => onPick('cod')}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-semibold text-foreground">{copy.codOnly}</span>
          <span className="text-caption text-muted-foreground">{copy.codOnlyHelp}</span>
        </span>
        {busy === 'cod' ? <Spinner /> : null}
      </button>
    </div>
  )
}
