import { notFound, redirect } from 'next/navigation'
import CustomerView from '@/components/customers/customer-view'
import { appRouter, call, serverContext } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

export default async function CustomerPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const customer = await call(appRouter.customers.get, { id }, { context }).catch(() => undefined)
  if (customer === undefined) redirect('/select-store')
  if (!customer) notFound()
  return <CustomerView customer={customer} />
}
