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
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">{current?.name ?? 'Store'}</h1>
      <p className="mt-2 text-neutral-600">
        Storefront is up. Product pages live at /products/[handle].
      </p>
    </main>
  )
}
