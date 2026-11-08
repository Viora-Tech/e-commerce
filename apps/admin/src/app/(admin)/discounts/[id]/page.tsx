import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import DiscountForm from '@/components/discounts/discount-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { orNoStoreOrMissing } from '@/lib/store-guard'

/** One read of the discount per server render: the tab title and the page share it. */
const loadDiscount = cache(async (id: string) =>
  call(appRouter.discounts.get, { id }, { context: await serverContext() }),
)

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const found = await loadDiscount(id).catch(() => null)
  return { title: found?.title || 'Discount' }
}

export default async function DiscountEditPage({ params }: Params) {
  const { id } = await params
  const discount = await loadDiscount(id).catch(orNoStoreOrMissing(undefined))
  if (discount === undefined) redirect('/select-store')
  if (!discount) notFound()
  return <DiscountForm discount={discount} />
}
