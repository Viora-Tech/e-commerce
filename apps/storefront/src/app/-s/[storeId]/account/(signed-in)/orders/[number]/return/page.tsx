import {
  customReasonCode,
  exchangeOptions,
  getCustomerOrder,
  orderReturnState,
} from '@commerce/core'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import ReturnForm, { type ReturnFormLine } from '@/components/account/return-form'
import { formatAccountDate } from '@/data/account'
import { returnsContent } from '@/data/returns'
import { storeTimeZone } from '@/lib/account'
import { requireCustomer } from '@/lib/customer-session'
import { inStore } from '@/lib/store-context'

type ReturnPageProps = {
  params: Promise<{ storeId: string; number: string }>
}

export async function generateMetadata({ params }: ReturnPageProps): Promise<Metadata> {
  const { number } = await params
  return { title: returnsContent.form.title(Number(number)) }
}

/** "Return or exchange": pick items, a reason and optional photos. */
export default async function AccountReturnPage({ params }: ReturnPageProps) {
  const { storeId, number } = await params
  const me = await requireCustomer(storeId, `/account/orders/${encodeURIComponent(number)}/return`)
  const data = await inStore(storeId, async (tx) => {
    const found = await getCustomerOrder({ storeId, tx }, me.id, Number(number))
    if (!found) return null
    return {
      order: found,
      state: await orderReturnState({ storeId, tx }, found.id),
      swaps: await exchangeOptions({ storeId, tx }, found.id),
      timeZone: await storeTimeZone(tx, storeId),
    }
  })
  if (!data?.state) notFound()
  if (!data.state.eligibility.open) redirect(`/account/orders/${data.order.number}`)

  const why = new Map(data.state.eligibility.lines.map((l) => [l.lineId, l]))
  const exchanges = data.state.policy.exchanges
  const lines: ReturnFormLine[] = data.state.lines.map((l) => ({
    id: l.id,
    title: l.title,
    variantTitle: l.variantTitle && l.variantTitle !== 'Default' ? l.variantTitle : null,
    imageUrl: l.imageUrl,
    returnable: why.get(l.id)?.returnable ?? 0,
    why: why.get(l.id)?.why ?? 'not_shipped',
    swaps: exchanges ? (data.swaps.get(l.id) ?? []) : [],
  }))
  // The store's own reasons go before "Something else", which stays last (#180).
  const { reasons: builtIn, customReasons } = data.state.policy
  const reasons = [
    ...builtIn.filter((r) => r !== 'other'),
    ...customReasons.map(customReasonCode),
    ...builtIn.filter((r) => r === 'other'),
  ]
  const closes = data.state.eligibility.closesAt
    ? formatAccountDate(data.state.eligibility.closesAt, data.timeZone)
    : ''

  return (
    <ReturnForm
      orderNumber={data.order.number}
      closesLabel={closes}
      lines={lines}
      reasons={reasons}
      exchanges={exchanges}
    />
  )
}
