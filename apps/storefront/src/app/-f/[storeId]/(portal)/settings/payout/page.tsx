import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import type { Metadata } from 'next'
import PayoutForm from '@/components/affiliate-portal/payout-form'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { requireAffiliate } from '@/lib/affiliate-portal'
import { loadAffiliatePortal } from '@/lib/affiliates'
import { outlookLines } from '@/lib/portal-format'

type PayoutSettingsPageProps = { params: Promise<{ storeId: string }> }

export const metadata: Metadata = { title: affiliatePortalContent.settings.tabs.payout }

/** Settings › Payout and tax: where payouts go, PAN and GSTIN, and what the next payout looks like. */
export default async function PayoutSettingsPage({ params }: PayoutSettingsPageProps) {
  // Hooks
  const { storeId } = await params
  const { me, affiliate } = await requireAffiliate(storeId)
  const portal = await loadAffiliatePortal(storeId, me)

  // Render logic
  const lines = portal?.outlook ? outlookLines(portal.outlook) : []
  return (
    <>
      <PayoutForm hint={affiliate.payoutHint} />
      {lines.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{affiliatePortalContent.payouts.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
