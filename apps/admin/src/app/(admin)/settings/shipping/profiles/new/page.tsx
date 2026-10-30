import type { Metadata } from 'next'
import ProfileForm from '@/components/shipping-zones/profile-form'

export const metadata: Metadata = { title: 'Create shipping profile' }

export default function NewShippingProfilePage() {
  return <ProfileForm profile={null} />
}
