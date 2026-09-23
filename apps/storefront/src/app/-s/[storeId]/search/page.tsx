import type { Metadata } from 'next'
import MainSearch from '@/components/search/main-search'
import { searchContent } from '@/data/search'
import { searchCardProducts } from '@/lib/catalog'
import { inStore } from '@/lib/store-context'
import { renderTemplate } from '@/lib/template-render'

type Params = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ q?: string; view?: string }>
}

export const metadata: Metadata = { title: searchContent.title, robots: { index: false } }

export default async function SearchPage({ params, searchParams }: Params) {
  const { storeId } = await params
  const { q, view } = await searchParams
  const query = typeof q === 'string' ? q.trim().slice(0, 100) : ''
  return inStore(storeId, async (tx) => {
    const products = await searchCardProducts(tx, query)
    return renderTemplate(tx, storeId, 'search', {
      view,
      renderers: { MainSearch: () => <MainSearch query={query} products={products} /> },
    })
  })
}
