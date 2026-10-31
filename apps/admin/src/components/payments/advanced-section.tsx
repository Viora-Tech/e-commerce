'use client'

import SettingsCard from '@/components/settings/settings-card'
import { paymentRulesContent } from '@/data/payment-rules'
import { paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import UpiOptions from './upi-options'

/**
 * Settings → Payments → More (the old Advanced): the two UPI options. Bank transfer and UPI QR
 * details, fees and unpaid-order rules are a row of their own on the page (#92); capture timing
 * has its own row too (Payment capture, #150).
 */
export default function AdvancedSection() {
  // Hooks
  const { advanced: copy } = useCopy(paymentsSetupContent)
  const { page } = useCopy(paymentRulesContent)

  return (
    <SettingsCard title={page.moreHeading} description={copy.help} bodyClassName="gap-4">
      <UpiOptions />
    </SettingsCard>
  )
}
