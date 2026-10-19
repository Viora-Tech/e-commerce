import type { Metadata } from 'next'
import CustomersBulkLoader from '@/components/customers/bulk-edit/customers-bulk-loader'
import { customersBulkEditContent } from '@/data/customers-bulk-edit'

export const metadata: Metadata = { title: customersBulkEditContent.title }

export default function Page() {
  return <CustomersBulkLoader />
}
