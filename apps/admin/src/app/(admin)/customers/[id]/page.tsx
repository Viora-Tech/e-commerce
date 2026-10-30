import { notFound, redirect } from 'next/navigation'
import CustomerView from '@/components/customers/customer-view'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { listApps } from '@/lib/shell-data'
import { orNoStoreOrMissing } from '@/lib/store-guard'

type Params = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}

export default async function CustomerPage({ params, searchParams }: Params) {
  const { id } = await params
  const { edit } = await searchParams
  const context = await serverContext()
  const [customer, apps] = await Promise.all([
    call(appRouter.customers.get, { id }, { context }).catch(orNoStoreOrMissing(undefined)),
    listApps().catch(() => []),
  ])
  if (customer === undefined) redirect(routes.selectStore())
  if (!customer) notFound()
  const appCards = apps.filter((a) => a.installed && a.admin.customerDetailCard).map((a) => a.id)
  // `?edit=1` (the order page's "View profile" → edit) opens the editor straight away.
  return <CustomerView customer={customer} appCards={appCards} startEditing={edit === '1'} />
}
