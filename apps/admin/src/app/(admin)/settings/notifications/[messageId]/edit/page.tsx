import type { Metadata } from 'next'
import DesignEditorPage from '@/components/notifications/design/design-editor-page'
import { emailDesignContent } from '@/data/email-design'
import { notificationsSettingsContent } from '@/data/notifications'

type Params = { params: Promise<{ messageId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { messageId } = await params
  const name = notificationsSettingsContent.messages[messageId]?.name ?? messageId
  return { title: emailDesignContent.editor.title(name) }
}

/** Settings → Notifications → a message → Edit: the email's block editor, full page. */
export default async function NotificationEditRoute({ params }: Params) {
  const { messageId } = await params
  return <DesignEditorPage messageId={decodeURIComponent(messageId)} />
}
