import type { Metadata } from 'next'
import { NO_INDEX } from '@/lib/seo'
import { inStore } from '@/lib/store-context'
import { renderTemplate } from '@/lib/template-render'
import CartContents from './cart-contents'

type Params = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ view?: string }>
}

export const metadata: Metadata = { robots: NO_INDEX }

export default async function CartPage({ params, searchParams }: Params) {
  const { storeId } = await params
  const { view } = await searchParams
  return inStore(storeId, (tx) =>
    renderTemplate(tx, storeId, 'cart', {
      view,
      renderers: { MainCart: () => <CartContents storeId={storeId} /> },
    }),
  )
}
