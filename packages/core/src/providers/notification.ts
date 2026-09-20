import type { StoreContext } from '../context'

export type NotificationChannel = 'email' | 'whatsapp' | 'sms'

export interface NotificationProvider {
  readonly id: string
  readonly channel: NotificationChannel
  send(
    ctx: StoreContext,
    message: { to: string; template: string; data: Record<string, unknown> },
  ): Promise<{ messageId: string }>
}
