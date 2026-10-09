'use client'

import { ChevronDown, ChevronRight } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import Link from 'next/link'
import { paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import UpiOptions from './upi-options'

/**
 * Advanced, closed by default: bank transfer / UPI QR, fees per method and
 * unpaid-order rules live on their own page. Capture timing is not a setting:
 * payments are captured when the shopper pays, so we say so instead.
 */
export default function AdvancedSection() {
  // Hooks
  const { advanced: copy } = useCopy(paymentsSetupContent)

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-fit items-center gap-1.5 text-body font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown aria-hidden="true" className="hidden size-4 group-data-[panel-open]:block" />
        <ChevronRight aria-hidden="true" className="size-4 group-data-[panel-open]:hidden" />
        {copy.heading}
        <span className="font-normal text-muted-foreground">· {copy.help}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-3">
          <CardContent className="flex flex-col gap-4">
            <UpiOptions />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 flex-col gap-0.5">
                <p className="text-body font-medium text-foreground">{copy.manual}</p>
                <p className="text-caption text-muted-foreground">{copy.manualHelp}</p>
              </div>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={routes.settings.paymentsAdvanced()} />}
              >
                {copy.open}
              </Button>
            </div>
            <p className="text-caption text-muted-foreground">{copy.captureNote}</p>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  )
}
