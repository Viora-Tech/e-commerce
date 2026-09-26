import type { api } from '@/lib/api-client'

/** What Settings → Notifications loads in one call. */
export type NotificationsOverview = Awaited<ReturnType<typeof api.notifications.overview>>

export type MessageRowData = NotificationsOverview['messages'][number]

export type ChannelStatusData = NotificationsOverview['channels']['email']

/** What the Sender email card loads and gets back from every action. */
export type SenderEmailOverview = Awaited<ReturnType<typeof api.notifications.senderEmail>>
