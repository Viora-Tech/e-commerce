import type { Metadata } from 'next'
import NotificationsPage from '@/components/account/notifications-page'
import { accountContent } from '@/data/account'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(accountContent)
  return { title: copy.notifications.title }
}

export default function Page() {
  return <NotificationsPage />
}
