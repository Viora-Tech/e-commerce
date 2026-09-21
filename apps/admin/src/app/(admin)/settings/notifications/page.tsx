import type { Metadata } from 'next'
import NotificationsSettings from './notifications-settings'

export const metadata: Metadata = { title: 'Notifications' }

export default function Page() {
  return <NotificationsSettings />
}
