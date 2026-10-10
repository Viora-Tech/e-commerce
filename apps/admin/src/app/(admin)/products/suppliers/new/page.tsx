import type { Metadata } from 'next'
import SupplierForm from '@/components/suppliers/supplier-form'
import { supplierFormContent } from '@/data/purchasing'

export const metadata: Metadata = { title: supplierFormContent.newTitle }

export default function Page() {
  return <SupplierForm supplier={null} />
}
