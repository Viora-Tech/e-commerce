'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import SettingsCard from '@/components/settings/settings-card'
import { paymentRulesContent } from '@/data/payment-rules'
import { paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import UpiOptions from './upi-options'

/**
 * Settings → Payments → More (the old Advanced): the two UPI options, and the page for bank
 * transfer and UPI QR details, fees per method and unpaid-order rules. Capture timing has its
 * own row now (Payment capture, #150).
 */
export default function AdvancedSection() {
  // Hooks
  const { advanced: copy } = useCopy(paymentsSetupContent)
  const { page } = useCopy(paymentRulesContent)

  return (
    <SettingsCard title={page.moreHeading} description={copy.help} bodyClassName="gap-4">
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
    </SettingsCard>
  )
}
