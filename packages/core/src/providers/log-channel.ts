import type {
  Message,
  NotificationChannel,
  NotificationChannelFactory,
  SendResult,
} from '@commerce/notifications'
import { renderEmail } from '@commerce/notifications'

export type LogChannelConfig = Record<string, never>

/**
 * Prints the rendered email to the worker console instead of sending it.
 * Lets a developer see every message an order would trigger with no
 * credentials; never enable it in production.
 */
export class LogNotificationChannel implements NotificationChannel {
  readonly id = 'log'
  readonly label = 'Worker log (development only)'
  readonly requires = 'email' as const

  constructor(private readonly write: (line: string) => void = console.log) {}

  async send(message: Message): Promise<SendResult> {
    if (!message.to.email) return { ok: false, error: 'recipient has no email' }
    const body = renderEmail(message.template, message.data)
    const providerRef = `log_${message.data.orderNumber}_${message.template}`
    this.write(`[notification] to=${message.to.email} subject=${body.subject}\n${body.text}`)
    return { ok: true, providerRef }
  }
}

export const logChannelFactory: NotificationChannelFactory<LogChannelConfig> = {
  id: 'log',
  label: 'Worker log (development only)',
  fields: [],
  validateConfig: () => ({ ok: true, config: {} }),
  create: () => new LogNotificationChannel(),
}
