import type { Metadata } from 'next'
import MessagePage from '@/components/notifications/message-page'
import { notificationsSettingsContent } from '@/data/notifications'

type Params = { params: Promise<{ messageId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { messageId } = await params
  return { title: notificationsSettingsContent.messages[messageId]?.name ?? 'Notification' }
}

/** Settings → Notifications → one customer message: its preview, test and on/off. */
export default async function NotificationMessageRoute({ params }: Params) {
  const { messageId } = await params
  return <MessagePage messageId={decodeURIComponent(messageId)} />
}
