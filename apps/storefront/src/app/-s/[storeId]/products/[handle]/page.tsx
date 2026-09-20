import { inventoryLevel, product, variant } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { formatPaise } from '@/lib/money'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; handle: string }> }

export default async function ProductPage({ params }: Params) {
  const { storeId, handle } = await params
  const data = await inStore(storeId, async (tx) => {
    const [p] = await tx
      .select()
      .from(product)
      .where(and(eq(product.handle, handle), eq(product.status, 'active')))
    if (!p) return null
    const variants = await tx
      .select({
        id: variant.id,
        title: variant.title,
        pricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise,
        onHand: inventoryLevel.onHand,
        reserved: inventoryLevel.reserved,
      })
      .from(variant)
      .leftJoin(inventoryLevel, eq(inventoryLevel.variantId, variant.id))
      .where(eq(variant.productId, p.id))
    return { product: p, variants }
  })
  if (!data) notFound()

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1>{data.product.title}</h1>
      <ul className="mt-8 divide-y divide-line rounded-section border border-line bg-surface">
        {data.variants.map((v) => {
          const available = (v.onHand ?? 0) - (v.reserved ?? 0)
          return (
            <li key={v.id} className="flex items-baseline justify-between px-5 py-4">
              <span>{v.title}</span>
              <span className="flex items-baseline gap-3">
                {v.mrpPaise && v.mrpPaise > v.pricePaise ? (
                  <s className="text-muted">{formatPaise(v.mrpPaise)}</s>
                ) : null}
                <span className="font-medium">{formatPaise(v.pricePaise)}</span>
                <span className={available > 0 ? 'text-success' : 'text-danger'}>
                  {available > 0 ? `${available} in stock` : 'Sold out'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
