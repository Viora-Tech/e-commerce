import type { Metadata } from 'next'
import PayoutForm from '@/components/affiliate-portal/payout-form'
import SettingsSection from '@/components/affiliate-portal/settings-section'
import { affiliateContent } from '@/data/affiliate'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { requireAffiliate } from '@/lib/affiliate-portal'

type PayoutSettingsPageProps = { params: Promise<{ storeId: string }> }

const copy = affiliateContent.payout

export const metadata: Metadata = { title: affiliatePortalContent.settings.tabs.payout }

/** Settings › Payout and tax: where payouts go (the saved one, masked, in the line on top), PAN and GSTIN. */
export default async function PayoutSettingsPage({ params }: PayoutSettingsPageProps) {
  // Hooks
  const { storeId } = await params
  const { affiliate } = await requireAffiliate(storeId)

  // Render logic
  return (
    <SettingsSection
      title={copy.title}
      description={affiliate.payoutHint ? copy.current(affiliate.payoutHint) : copy.none}
    >
      <PayoutForm />
    </SettingsSection>
  )
}
