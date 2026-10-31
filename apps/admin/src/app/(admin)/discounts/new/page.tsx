import type { Metadata } from 'next'
import DiscountForm from '@/components/discounts/discount-form'

export const metadata: Metadata = { title: 'Create discount' }

type Props = { searchParams: Promise<{ segment?: string | string[] }> }

/** `?segment=` (a segment's "Create discount") starts it for that segment's customers. */
export default async function NewDiscountPage({ searchParams }: Props) {
  const { segment } = await searchParams
  return <DiscountForm discount={null} segmentId={typeof segment === 'string' ? segment : null} />
}
