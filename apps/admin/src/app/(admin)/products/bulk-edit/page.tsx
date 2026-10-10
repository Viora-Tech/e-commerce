import { BULK_EDIT_MAX } from '@commerce/core/catalog'
import { LayoutGrid } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import { z } from 'zod'
import SectionEmpty from '@/components/layout/section-empty'
import BulkEditor from '@/components/products/bulk-edit/bulk-editor'
import { bulkEditContent } from '@/data/bulk-edit'
import { appRouter, call, serverContext } from '@/lib/api'
import type { SearchParams } from '@/lib/list-query'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: bulkEditContent.title }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const raw = (await searchParams).ids
  const list = (Array.isArray(raw) ? raw[0] : raw)?.split(',') ?? []
  const ids = [...new Set(list.filter((id) => z.uuid().safeParse(id).success))].slice(
    0,
    BULK_EDIT_MAX,
  )
  if (ids.length === 0) {
    const { heading, body, action } = bulkEditContent.empty
    return (
      <SectionEmpty
        heading={heading}
        body={body}
        action={{ label: action, href: routes.products.list() }}
        icon={LayoutGrid}
      />
    )
  }
  const context = await serverContext()
  const sheet = await call(appRouter.products.bulkEditSheet, { ids }, { context })
  return <BulkEditor sheet={sheet} productIds={ids} />
}
