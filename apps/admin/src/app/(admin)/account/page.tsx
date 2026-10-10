import type { Metadata } from 'next'
import ProfilePage from '@/components/account/profile-page'
import { accountContent } from '@/data/account'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(accountContent)
  return { title: copy.profile.title }
}

export default function Page() {
  return <ProfilePage />
}
