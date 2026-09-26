import type { api } from '@/lib/api-client'

/** What Settings → Notifications loads in one call. */
export type NotificationsOverview = Awaited<ReturnType<typeof api.notifications.overview>>

export type MessageRowData = NotificationsOverview['messages'][number]

export type ChannelStatusData = NotificationsOverview['channels']['email']
