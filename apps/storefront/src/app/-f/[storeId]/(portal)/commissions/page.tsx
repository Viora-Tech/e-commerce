import { Download, TrendingUp } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { Metadata } from 'next'
import Link from 'next/link'
import CommissionFilters from '@/components/affiliate-portal/commission-filters'
import CommissionsTable from '@/components/affiliate-portal/commissions-table'
import PortalEmpty from '@/components/affiliate-portal/portal-empty'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { portalHref, requireAffiliate } from '@/lib/affiliate-portal'
import { commissionFilters, loadCommissions } from '@/lib/portal-data'

type CommissionsPageProps = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const copy = affiliatePortalContent.commissions

/** How many rows the page loads; the CSV has up to 1,000. */
const PAGE_ROWS = 500

export const metadata: Metadata = { title: copy.metaTitle }

/**
 * Every commission their link or code brought: status tabs, source and date filters, Export,
 * and the table with pagination (dashboard-01's DataTable); the privacy line sits under it.
 */
export default async function CommissionsPage({ params, searchParams }: CommissionsPageProps) {
  // Hooks
  const { storeId } = await params
  const { affiliate, base } = await requireAffiliate(storeId)
  const { status: _status, ...filters } = commissionFilters(await searchParams)
  const rows = await loadCommissions(storeId, affiliate.id, { ...filters, limit: PAGE_ROWS })

  // Render logic
  const qs = new URLSearchParams(
    Object.entries(filters).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString()
  const exportHref = `${portalHref(base, '/export/commissions')}${qs ? `?${qs}` : ''}`
  return (
    <>
      <CommissionsTable
        rows={rows}
        empty={copy.empty}
        none={
          qs ? undefined : (
            <PortalEmpty
              icon={TrendingUp}
              title={copy.none.title}
              description={copy.none.text}
              action={
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href={portalHref(base, '/')} />}
                >
                  {copy.none.action}
                </Button>
              }
            />
          )
        }
        pageSize={20}
        toolbar={
          <>
            <CommissionFilters value={filters} />
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={exportHref} download />}
            >
              <Download />
              {copy.export}
            </Button>
          </>
        }
      />
      <p className="px-4 text-sm text-muted-foreground lg:px-6">
        {rows.length >= PAGE_ROWS ? `${copy.help} ${copy.limit(PAGE_ROWS)}` : copy.help}
      </p>
    </>
  )
}
