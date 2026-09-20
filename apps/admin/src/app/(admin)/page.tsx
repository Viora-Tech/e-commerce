import { redirect } from 'next/navigation'
import { appRouter, call, serverContext } from '@/lib/api'
import { HomePage } from './home-page'

export default async function Home() {
  const context = await serverContext()
  const current = await call(appRouter.store.current, undefined, { context }).catch(() => null)
  if (!current) redirect('/select-store')
  const [products, orders] = await Promise.all([
    call(appRouter.products.list, { page: 1, perPage: 1 }, { context }),
    call(appRouter.orders.list, { page: 1, perPage: 100 }, { context }),
  ])
  const revenuePaise = orders.items
    .filter((o) => o.status !== 'cancelled')
    .reduce((n, o) => n + o.totalPaise, 0)
  return (
    <HomePage
      storeName={current.name}
      role={current.role}
      productCount={products.total}
      orderCount={orders.total}
      revenuePaise={revenuePaise}
    />
  )
}
