import type { Metadata } from 'next'
import ProfileForm from '@/components/account/profile-form'
import { accountContent } from '@/data/account'
import { requireCustomer } from '@/lib/customer-session'

type ProfilePageProps = { params: Promise<{ storeId: string }> }

export const metadata: Metadata = { title: accountContent.profile.title }

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { storeId } = await params
  const me = await requireCustomer(storeId, '/account/profile')
  return <ProfileForm customer={me} />
}
