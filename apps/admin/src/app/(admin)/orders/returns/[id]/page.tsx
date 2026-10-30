import { notFound, redirect } from 'next/navigation'
import ReturnView from '@/components/returns/return-view'
import { appRouter, call, serverContext } from '@/lib/api'
import { orNoStoreOrMissing } from '@/lib/store-guard'

type Params = { params: Promise<{ id: string }> }

export default async function ReturnPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const detail = await call(appRouter.returns.get, { id }, { context }).catch(orNoStoreOrMissing(undefined))
  if (detail === undefined) redirect('/select-store')
  if (!detail) notFound()
  return <ReturnView detail={detail} />
}
