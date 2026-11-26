import { CreditCard, Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@commerce/ui/shadcn/item'
import type { Metadata } from 'next'
import Link from 'next/link'
import PayoutsTable from '@/components/affiliate-portal/payouts-table'
import { affiliateContent } from '@/data/affiliate'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { portalHref, requireAffiliate } from '@/lib/affiliate-portal'
import { loadPayouts } from '@/lib/portal-data'

type PayoutsPageProps = { params: Promise<{ storeId: string }> }

const copy = affiliatePortalContent.payouts

export const metadata: Metadata = { title: copy.metaTitle }

/**
 * Where payouts go (shadcn's Item: icon, the masked method, Add or Change), then the Payouts card
 * with Export in its corner and the table with the money breakdown inside.
 */
export default async function PayoutsPage({ params }: PayoutsPageProps) {
  // Hooks
  const { storeId } = await params
  const { affiliate, base } = await requireAffiliate(storeId)
  const rows = await loadPayouts(storeId, affiliate.id)

  // Render logic
  const payout = affiliateContent.payout
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <Item variant="outline" className="bg-card px-4 py-3">
        <ItemMedia variant="icon">
          <CreditCard />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{copy.method}</ItemTitle>
          <ItemDescription>
            {affiliate.payoutHint ? payout.current(affiliate.payoutHint) : copy.methodMissing}
          </ItemDescription>
        </ItemContent>
        <ItemActions className="basis-full sm:basis-auto">
          <Button
            variant={affiliate.payoutHint ? 'outline' : 'default'}
            size="sm"
            nativeButton={false}
            render={<Link href={portalHref(base, '/settings/payout')} />}
          >
            {affiliate.payoutHint ? copy.change : copy.add}
          </Button>
        </ItemActions>
      </Item>
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.help}</CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={portalHref(base, '/export/payouts')} download />}
            >
              <Download />
              {copy.export}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <PayoutsTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  )
}
