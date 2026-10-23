'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { paymentModesContent } from '@/data/payment-modes'
import { gatewayCatalogue, paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import GatewayActiveFooter from './gateway-active-footer'
import GatewayLogo from './gateway-logo'
import GatewaySwitches from './gateway-switches'
import type { GatewayApp } from './types'

type OtherGatewayCardProps = {
  gateway: GatewayApp
  onlyOnline: boolean
  onChanged: () => Promise<void>
}

const monogramOf = (id: string) =>
  gatewayCatalogue.find((g) => g.id === id)?.monogram ?? id.slice(0, 2)

/** A connected payment company that is not the main one (Decentro UPI, a second gateway). */
export default function OtherGatewayCard({
  gateway,
  onlyOnline,
  onChanged,
}: OtherGatewayCardProps) {
  // Hooks
  const { main: copy } = useCopy(paymentsSetupContent)
  const modes = useCopy(paymentModesContent)

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <GatewayLogo id={gateway.id} monogram={monogramOf(gateway.id)} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <p className="text-body font-semibold text-foreground">{gateway.name}</p>
            {gateway.mode ? (
              <StatusChip tone={gateway.mode === 'live' ? 'success' : 'attention'}>
                {gateway.mode === 'live' ? copy.live : copy.test}
              </StatusChip>
            ) : null}
            {gateway.connected ? null : <StatusChip tone="neutral">{modes.active.off}</StatusChip>}
          </div>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.apps.connect(gateway.id)} />}
          >
            {copy.manage}
          </Button>
        </div>
        <GatewaySwitches gateway={gateway} onChanged={onChanged} />
        <GatewayActiveFooter
          gateway={gateway}
          name={gateway.name}
          onlyOnline={onlyOnline}
          onChanged={onChanged}
        />
      </CardContent>
    </Card>
  )
}
