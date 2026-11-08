import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import CustomerView from '@/components/customers/customer-view'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { listApps } from '@/lib/shell-data'
import { orNoStoreOrMissing } from '@/lib/store-guard'

/** One read of the customer per server render: the tab title and the page share it. */
const loadCustomer = cache(async (id: string) =>
  call(appRouter.customers.get, { id }, { context: await serverContext() }),
)

type Params = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}

/** The customer's name in the browser tab, not "Admin". */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const customer = await loadCustomer(id).catch(() => null)
  return { title: customer?.name || customer?.email || 'Customer' }
}

export default async function CustomerPage({ params, searchParams }: Params) {
  const { id } = await params
  const { edit } = await searchParams
  const [customer, apps] = await Promise.all([
    loadCustomer(id).catch(orNoStoreOrMissing(undefined)),
    listApps().catch(() => []),
  ])
  if (customer === undefined) redirect(routes.selectStore())
  if (!customer) notFound()
  const appCards = apps.filter((a) => a.installed && a.admin.customerDetailCard).map((a) => a.id)
  // `?edit=1` (the order page's "View profile" → edit) opens the editor straight away.
  return <CustomerView customer={customer} appCards={appCards} startEditing={edit === '1'} />
}
