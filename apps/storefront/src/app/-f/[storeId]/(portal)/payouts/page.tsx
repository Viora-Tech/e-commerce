import { Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeading from '@/components/affiliate-portal/page-heading'
import PayoutsTable from '@/components/affiliate-portal/payouts-table'
import { affiliateContent } from '@/data/affiliate'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { portalHref, requireAffiliate } from '@/lib/affiliate-portal'
import { loadPayouts } from '@/lib/portal-data'

type PayoutsPageProps = { params: Promise<{ storeId: string }> }

const copy = affiliatePortalContent.payouts

export const metadata: Metadata = { title: copy.metaTitle }

/** Their payouts with the money breakdown, where payouts go, and Export. */
export default async function PayoutsPage({ params }: PayoutsPageProps) {
  // Hooks
  const { storeId } = await params
  const { affiliate, base } = await requireAffiliate(storeId)
  const rows = await loadPayouts(storeId, affiliate.id)

  // Render logic
  const payout = affiliateContent.payout
  return (
    <>
      <PageHeading
        description={copy.help}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={portalHref(base, '/settings/payout')} />}
            >
              {copy.change}
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={portalHref(base, '/export/payouts')} download />}
            >
              <Download />
              {copy.export}
            </Button>
          </>
        }
      />
      <p className="px-4 text-sm lg:px-6">
        <span className="text-muted-foreground">{copy.method}: </span>
        {affiliate.payoutHint ? payout.current(affiliate.payoutHint) : payout.none}
      </p>
      <PayoutsTable rows={rows} />
    </>
  )
}
