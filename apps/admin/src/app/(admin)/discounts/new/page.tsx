import type { Metadata } from 'next'
import DiscountForm from '@/components/discounts/discount-form'

export const metadata: Metadata = { title: 'Create discount' }

export default function NewDiscountPage() {
  return <DiscountForm discount={null} />
}
