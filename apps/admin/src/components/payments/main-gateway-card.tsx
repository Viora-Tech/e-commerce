'use client'

import { CircleCheck, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { paymentModesContent } from '@/data/payment-modes'
import { gatewayCatalogue, paymentsSetupContent } from '@/data/payments-setup'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import GatewayActiveFooter from './gateway-active-footer'
import GatewayLogo from './gateway-logo'
import GatewayProblem from './gateway-problem'
import GatewaySwitches from './gateway-switches'
import type { GatewayApp, GatewayStatus } from './types'

type MainGatewayCardProps = {
  primary: GatewayStatus | null
  /** The primary gateway's app row: its Live/Test and Active/Inactive switches. */
  gateway: GatewayApp | undefined
  /** It is the only online gateway on at checkout. */
  onlyOnline: boolean
  onAdd: () => void
  onChanged: () => void
  onTurnOnUpi: () => void
  /**
   * `page`: the gateway's own page, Shopify style: the "Test mode" card and a red Deactivate
   * sit under this card. `card` (Payments overview): the mode chip only; both live on that page.
   */
  layout?: 'card' | 'page'
}

const monogramOf = (id: string) =>
  gatewayCatalogue.find((g) => g.id === id)?.monogram ?? id.slice(0, 2)

/** "Main way to get paid": who takes the money, Test or Live, whether it works, the last payment. */
export default function MainGatewayCard({
  primary,
  gateway,
  onlyOnline,
  onAdd,
  onChanged,
  onTurnOnUpi,
  layout = 'card',
}: MainGatewayCardProps) {
  // Hooks
  const { main: copy } = useCopy(paymentsSetupContent)
  const { active: activeCopy } = useCopy(paymentModesContent)
  const fmt = useFormat()

  // Early returns
  if (!primary) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-body font-semibold text-foreground">{copy.empty}</p>
            <p className="text-body text-muted-foreground">{copy.emptyHelp}</p>
          </div>
          <Button size="lg" className="gap-1.5" onClick={onAdd}>
            <Plus aria-hidden="true" className="size-4" />
            {copy.connect}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Render logic
  const healthy = primary.problems.length === 0

  const card = (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-3">
          <GatewayLogo id={primary.id} monogram={monogramOf(primary.id)} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-body font-semibold text-foreground">{primary.label}</p>
              {primary.mode ? (
                <StatusChip tone={primary.mode === 'live' ? 'success' : 'attention'}>
                  {primary.mode === 'live' ? copy.live : copy.test}
                </StatusChip>
              ) : null}
              {gateway && !gateway.connected ? (
                <StatusChip tone="neutral">{activeCopy.off}</StatusChip>
              ) : null}
              {healthy ? (
                <span className="flex items-center gap-1 text-caption font-medium text-success">
                  <CircleCheck aria-hidden="true" className="size-3.5" />
                  {copy.working}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-caption font-medium text-destructive">
                  <span aria-hidden="true" className="size-2 rounded-full bg-destructive" />
                  {copy.notWorking}
                </span>
              )}
            </div>
            <p className="text-caption text-muted-foreground">
              {primary.via === 'oauth' ? copy.viaOauth : copy.viaKeys}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.apps.connect(primary.id)} />}
            >
              {copy.manage}
            </Button>
            <Button variant="ghost" onClick={onAdd}>
              {copy.change}
            </Button>
          </div>
        </div>

        <dl className="grid gap-3 text-body sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-caption text-muted-foreground">{copy.lastPayment}</dt>
            <dd className="font-medium text-foreground">
              {primary.lastPayment
                ? `${fmt.money(primary.lastPayment.amountPaise)} · ${fmt.ago(primary.lastPayment.at)}`
                : copy.noPaymentsYet}
            </dd>
          </div>
        </dl>

        {primary.mode === 'test' ? (
          <p className="text-caption text-muted-foreground">{copy.testHelp}</p>
        ) : null}

        {healthy ? null : (
          <ul className="flex flex-col gap-2">
            {primary.problems.map((p) => (
              <GatewayProblem
                key={p.code}
                problem={p}
                gatewayId={primary.id}
                onFixed={onChanged}
                onTurnOnUpi={onTurnOnUpi}
              />
            ))}
          </ul>
        )}

        {gateway && layout === 'card' ? (
          <GatewayActiveFooter
            gateway={gateway}
            name={primary.label}
            onlyOnline={onlyOnline}
            onChanged={onChanged}
          />
        ) : null}
      </CardContent>
    </Card>
  )

  if (layout === 'card' || !gateway) return card

  return (
    <>
      {card}
      <GatewaySwitches gateway={gateway} onChanged={onChanged} />
      <GatewayActiveFooter
        gateway={gateway}
        name={primary.label}
        onlyOnline={onlyOnline}
        onChanged={onChanged}
        placement="page"
      />
    </>
  )
}
