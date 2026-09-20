import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string }> }

export default async function Home({ params }: Params) {
  const { storeId } = await params
  const current = await inStore(storeId, async (tx) => {
    const [s] = await tx.select().from(store).where(eq(store.id, storeId))
    return s
  })
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1>{current?.name ?? 'Store'}</h1>
      <p className="mt-3 text-muted">Storefront is up. Product pages live at /products/[handle].</p>
    </main>
  )
}
