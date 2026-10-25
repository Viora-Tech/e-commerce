import type { Metadata } from 'next'
import OrdersBulkLoader from '@/components/orders/bulk-edit/orders-bulk-loader'
import { ordersBulkEditContent } from '@/data/orders-bulk-edit'

export const metadata: Metadata = { title: ordersBulkEditContent.title }

export default function Page() {
  return <OrdersBulkLoader />
}
