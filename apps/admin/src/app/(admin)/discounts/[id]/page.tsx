import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import DiscountForm from '@/components/discounts/discount-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { orNoStoreOrMissing } from '@/lib/store-guard'

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const context = await serverContext()
  const found = await call(appRouter.discounts.get, { id }, { context }).catch(() => null)
  return { title: found?.title || 'Discount' }
}

export default async function DiscountEditPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const discount = await call(appRouter.discounts.get, { id }, { context }).catch(
    orNoStoreOrMissing(undefined),
  )
  if (discount === undefined) redirect('/select-store')
  if (!discount) notFound()
  return <DiscountForm discount={discount} />
}
