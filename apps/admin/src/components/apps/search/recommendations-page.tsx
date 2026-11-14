'use client'

import { SEARCH_ID } from '@commerce/plugin-search'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { TableCell } from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import SelectProductsDialog, {
  type PickedProducts,
} from '@/components/products/select-products-dialog'
import LinkRow from '@/components/table/link-row'
import SimpleTable from '@/components/table/simple-table'
import { searchDiscoveryContent } from '@/data/search-discovery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Row = Awaited<ReturnType<typeof api.search.recommendations.list>>[number]

/** The editor for one product's picks. */
export const editorHref = (productId: string) =>
  routes.apps.page(SEARCH_ID, 'recommendations', productId)

/**
 * The Search & discovery app's Recommendations page: the products that have hand-picked
 * recommendations, and "Choose a product" to pick for another one (the editor is a full page).
 */
export default function RecommendationsPage() {
  // Hooks
  const copy = useCopy(searchDiscoveryContent)
  const fmt = useFormat()
  const router = useRouter()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [choosing, setChoosing] = useState(false)

  useEffect(() => {
    api.search.recommendations.list().then(setRows)
  }, [])

  // Event handlers
  const handleChosen = (picked: PickedProducts) => {
    const first = picked[0]
    if (first) router.push(editorHref(first.product.id))
  }

  // Early returns
  if (!rows) return null

  // Render logic
  const c = copy.recommendations

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={c.title}
        summary={c.summary}
        actions={
          <Button onClick={() => setChoosing(true)}>
            <Plus aria-hidden="true" />
            {c.choose}
          </Button>
        }
      />
      <DataCard title={c.listTitle} count={rows.length} flush>
        {rows.length === 0 ? (
          <EmptyState variant="inline" body={c.empty} className="mx-5 my-6" />
        ) : (
          <SimpleTable
            className="min-w-[32rem]"
            columns={[
              { key: 'product', label: c.columns.product },
              { key: 'related', label: c.columns.related, align: 'end', className: 'w-36' },
              {
                key: 'complementary',
                label: c.columns.complementary,
                align: 'end',
                className: 'w-36',
              },
            ]}
          >
            {rows.map((row) => (
              <LinkRow key={row.id} href={editorHref(row.id)}>
                <TableCell className="max-w-0 font-medium">
                  <Link href={editorHref(row.id)} className="block truncate hover:underline">
                    {row.title}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmt.number(row.related)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt.number(row.complementary)}
                </TableCell>
              </LinkRow>
            ))}
          </SimpleTable>
        )}
      </DataCard>
      <SelectProductsDialog open={choosing} onOpenChange={setChoosing} onConfirm={handleChosen} />
    </div>
  )
}
