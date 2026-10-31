import type { Metadata } from 'next'
import { cartContent } from '@/data/cart'
import { NO_INDEX } from '@/lib/seo'
import { renderTemplate } from '@/lib/template-render'
import CartContents from './cart-contents'

type Params = {
  params: Promise<{ storeId: string }>
  /** `skipped`: items "Buy again" could not add (#162), with `skipped_more` beyond those. */
  searchParams: Promise<{ view?: string; skipped?: string | string[]; skipped_more?: string }>
}

export const metadata: Metadata = { title: cartContent.title, robots: NO_INDEX }

export default async function CartPage({ params, searchParams }: Params) {
  const { storeId } = await params
  const { view, skipped, skipped_more: more } = await searchParams
  const reorderSkipped = {
    titles: (Array.isArray(skipped) ? skipped : skipped ? [skipped] : []).slice(0, 5),
    more: Math.max(0, Number.parseInt(more ?? '0', 10) || 0),
  }
  return renderTemplate(storeId, 'cart', {
    view,
    renderers: {
      MainCart: () => <CartContents storeId={storeId} reorderSkipped={reorderSkipped} />,
    },
  })
}
