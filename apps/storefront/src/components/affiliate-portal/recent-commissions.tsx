import type { PortalSale } from '@commerce/plugin-affiliates/server'
import { TrendingUp } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import CommissionsGrid from './commissions-grid'
import PortalEmpty from './portal-empty'

type RecentCommissionsProps = {
  rows: PortalSale[]
  /** The Commissions page, for "See all". */
  href: string
}

const copy = affiliatePortalContent.dashboard
const none = affiliatePortalContent.commissions.none

/** How many rows the dashboard shows; the rest are on the Commissions page. */
const ROWS = 5

/**
 * The dashboard's "Latest commissions" card: the newest five in a plain table (no tabs or
 * pagination, those are on the Commissions page) with See all in the corner, or shadcn's Empty
 * while there are none.
 */
export default function RecentCommissions({ rows, href }: RecentCommissionsProps) {
  // Render logic
  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>{copy.recent}</CardTitle>
          <CardDescription>{copy.recentHelp}</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href} />}>
              {copy.seeAll}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <PortalEmpty
              icon={TrendingUp}
              title={none.title}
              description={none.text}
              className="rounded-lg border border-dashed p-6 md:p-8"
            />
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <CommissionsGrid rows={rows.slice(0, ROWS)} empty={null} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
