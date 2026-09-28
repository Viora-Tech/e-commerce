import { notFound, redirect } from 'next/navigation'
import CustomerView from '@/components/customers/customer-view'
import { appRouter, call, serverContext } from '@/lib/api'

type Params = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}

export default async function CustomerPage({ params, searchParams }: Params) {
  const { id } = await params
  const { edit } = await searchParams
  const context = await serverContext()
  const customer = await call(appRouter.customers.get, { id }, { context }).catch(() => undefined)
  if (customer === undefined) redirect('/select-store')
  if (!customer) notFound()
  // `?edit=1` (the order page's "View profile" → edit) opens the editor straight away.
  return <CustomerView customer={customer} startEditing={edit === '1'} />
}
