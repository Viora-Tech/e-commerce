import type { Metadata } from 'next'
import ZoneForm from '@/components/shipping-zones/zone-form'

export const metadata: Metadata = { title: 'Create shipping zone' }

type Props = { searchParams: Promise<{ profile?: string | string[] }> }

export default async function NewShippingZonePage({ searchParams }: Props) {
  const { profile } = await searchParams
  return <ZoneForm zone={null} profileId={typeof profile === 'string' ? profile : null} />
}
