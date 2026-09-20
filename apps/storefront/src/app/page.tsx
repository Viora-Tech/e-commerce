import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { inStore } from '@/lib/store-context'

export default async function Home() {
  const current = await inStore(async (tx, storeId) => {
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
