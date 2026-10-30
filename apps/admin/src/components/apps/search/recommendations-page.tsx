'use client'

import { SEARCH_ID } from '@commerce/plugin-search'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import KitTable from '@/components/kit/kit-table'
import KitTableHead from '@/components/kit/kit-table-head'
import KitTableRow from '@/components/kit/kit-table-row'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import SelectProductsDialog, {
  type PickedProducts,
} from '@/components/products/select-products-dialog'
import { searchDiscoveryContent } from '@/data/search-discovery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Row = Awaited<ReturnType<typeof api.search.recommendations.list>>[number]

const COLUMNS = 'minmax(12rem,1fr) 9rem 9rem'

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
          <p className="px-5 py-6 text-body text-muted-foreground">{c.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <KitTable className="min-w-[32rem]">
              <KitTableHead columns={COLUMNS}>
                <span>{c.columns.product}</span>
                <span className="justify-end">{c.columns.related}</span>
                <span className="justify-end">{c.columns.complementary}</span>
              </KitTableHead>
              {rows.map((row) => (
                <KitTableRow key={row.id} columns={COLUMNS} href={editorHref(row.id)}>
                  <span className="truncate font-medium">{row.title}</span>
                  <span className="justify-end tabular-nums">{fmt.number(row.related)}</span>
                  <span className="justify-end tabular-nums">{fmt.number(row.complementary)}</span>
                </KitTableRow>
              ))}
            </KitTable>
          </div>
        )}
      </DataCard>
      <SelectProductsDialog open={choosing} onOpenChange={setChoosing} onConfirm={handleChosen} />
    </div>
  )
}
