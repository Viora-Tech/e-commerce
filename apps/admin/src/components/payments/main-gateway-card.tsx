'use client'

import { CircleCheck, Plus } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { gatewayCatalogue, paymentsSetupContent as setupCopy } from '@/data/payments-setup'
import { formatAgo } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'
import GatewayLogo from './gateway-logo'
import GatewayProblem from './gateway-problem'
import type { GatewayStatus } from './types'

type MainGatewayCardProps = {
  primary: GatewayStatus | null
  onAdd: () => void
  onChanged: () => void
  onTurnOnUpi: () => void
}

const copy = setupCopy.main

const monogramOf = (id: string) =>
  gatewayCatalogue.find((g) => g.id === id)?.monogram ?? id.slice(0, 2)

/** "Main way to get paid": who takes the money, Test or Live, whether it works, the last payment. */
export default function MainGatewayCard({
  primary,
  onAdd,
  onChanged,
  onTurnOnUpi,
}: MainGatewayCardProps) {
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

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-3">
          <GatewayLogo monogram={monogramOf(primary.id)} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-body font-semibold text-foreground">{primary.label}</p>
              {primary.mode ? (
                <Badge variant={primary.mode === 'live' ? 'success' : 'warning'}>
                  {primary.mode === 'live' ? copy.live : copy.test}
                </Badge>
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
              render={<Link href={`/apps/${primary.id}/connect`} />}
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
                ? `${formatPaise(primary.lastPayment.amountPaise)} · ${formatAgo(primary.lastPayment.at)}`
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
      </CardContent>
    </Card>
  )
}
