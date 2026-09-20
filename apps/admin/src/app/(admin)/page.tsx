import { redirect } from 'next/navigation'
import { appRouter, call, serverContext } from '@/lib/api'
import { HomePage } from './home-page'

export default async function Home() {
  const context = await serverContext()
  const current = await call(appRouter.store.current, undefined, { context }).catch(() => null)
  if (!current) redirect('/select-store')
  const products = await call(appRouter.products.list, { page: 1, perPage: 1 }, { context })
  return <HomePage storeName={current.name} role={current.role} productCount={products.total} />
}
