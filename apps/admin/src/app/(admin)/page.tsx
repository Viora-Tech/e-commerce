import { redirect } from 'next/navigation'
import { appRouter, call, serverContext } from '@/lib/api'
import { HomePage } from './home-page'

const RECENT = 8

export default async function Home() {
  const context = await serverContext()
  const current = await call(appRouter.store.current, undefined, { context }).catch(() => null)
  if (!current) redirect('/select-store')
  const [products, orders] = await Promise.all([
    call(appRouter.products.list, { page: 1, perPage: 1 }, { context }),
    call(appRouter.orders.list, { page: 1, perPage: 100 }, { context }),
  ])
  const live = orders.items.filter((o) => o.status !== 'cancelled')
  const revenuePaise = live.reduce((n, o) => n + o.totalPaise, 0)
  const awaitingPayment = orders.items.filter((o) => o.status === 'placed').length
  return (
    <HomePage
      storeName={current.name}
      role={current.role}
      productCount={products.total}
      orderCount={orders.total}
      revenuePaise={revenuePaise}
      awaitingPayment={awaitingPayment}
      recentOrders={orders.items.slice(0, RECENT)}
      revenueTrend={dailyRevenue(live)}
    />
  )
}

/** Revenue per day over the last 14 days, oldest first, for the sparkline. */
function dailyRevenue(orders: { placedAt: Date | string; totalPaise: number }[]): number[] {
  const days = 14
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const buckets = Array.from({ length: days }, () => 0)
  for (const o of orders) {
    const d = new Date(o.placedAt)
    d.setHours(0, 0, 0, 0)
    const idx = days - 1 - Math.round((today.getTime() - d.getTime()) / 86_400_000)
    if (idx >= 0 && idx < days) buckets[idx] = (buckets[idx] ?? 0) + o.totalPaise
  }
  return buckets
}
