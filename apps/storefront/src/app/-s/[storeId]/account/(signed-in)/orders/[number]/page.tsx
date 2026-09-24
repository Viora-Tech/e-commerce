import { loadEnv } from '@commerce/config'
import { getCustomerOrder, installedApps } from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import { order, withStore } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import OrderDetail from '@/components/account/order-detail'
import BalanceDue from '@/components/checkout/balance-due'
import { accountContent } from '@/data/account'
import { storeTimeZone } from '@/lib/account'
import { requireCustomer } from '@/lib/customer-session'
import { db } from '@/lib/db'
import { storeCheckoutMethods } from '@/lib/payments'
import { balanceView, storePreorderPolicy } from '@/lib/preorder'
import { inStore } from '@/lib/store-context'

type OrderPageProps = {
  params: Promise<{ storeId: string; number: string }>
  searchParams: Promise<{ reorder?: string }>
}

export async function generateMetadata({
  params,
}: Pick<OrderPageProps, 'params'>): Promise<Metadata> {
  const { number } = await params
  return { title: accountContent.orders.order(Number(number)) }
}

export default async function AccountOrderPage({ params, searchParams }: OrderPageProps) {
  const { storeId, number } = await params
  const me = await requireCustomer(storeId, `/account/orders/${encodeURIComponent(number)}`)
  const data = await inStore(storeId, async (tx) => {
    const found = await getCustomerOrder({ storeId, tx }, me.id, Number(number))
    if (!found) return null
    const methods = await storeCheckoutMethods(tx, storeId).catch(() => [])
    // A deposit pre-order with its balance still owed gets the "Pay balance" block.
    const [raw] =
      found.balanceDuePaise > 0 ? await tx.select().from(order).where(eq(order.id, found.id)) : []
    return {
      order: found,
      timeZone: await storeTimeZone(tx, storeId),
      methodLabel: methods.find((m) => m.id === found.paymentMethod)?.label ?? null,
      balance: raw ? balanceView(raw, await storePreorderPolicy(tx, storeId)) : null,
    }
  })
  if (!data) notFound()

  const env = loadEnv(process.env)
  // Documents installed apps offer for this order, e.g. the GST invoice download.
  const links = await getRegistries().orderLinks(
    await installedApps(db(), storeId),
    {
      storeId,
      inStore: (fn) => withStore(db(), storeId, fn),
      settingsSecret: env.SETTINGS_SECRET,
      storefrontUrl: env.STOREFRONT_URL ?? null,
      surface: 'storefront',
    },
    data.order.id,
  )
  return (
    <OrderDetail
      order={data.order}
      timeZone={data.timeZone}
      paymentMethodLabel={data.methodLabel}
      links={links}
      reorderEmpty={(await searchParams).reorder === 'none'}
      balance={
        data.balance ? (
          <BalanceDue
            orderNumber={data.order.number}
            balance={data.balance}
            timeZone={data.timeZone}
          />
        ) : null
      }
    />
  )
}
