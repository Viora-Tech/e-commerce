/** SOURCE OF TRUTH: development SMS channel — WHAT: a phone channel with medium `sms` that prints each text message to the console instead of sending it / WHY: SMS sign-in codes can be built and tested with no SMS provider account, and without ever texting a real number */
import type {
  Message,
  NotificationChannel,
  NotificationChannelFactory,
  SendResult,
} from '@commerce/notifications'

export type LogSmsChannelConfig = Record<string, never>

/** The one-line SMS each template becomes; only sign-in codes are texted today. */
function smsText(message: Message): string {
  const store = message.data.storeName
  if (message.template === 'login_code') {
    return `${message.data.code ?? ''} is your ${store} code. It expires in 10 minutes. Do not share it.`
  }
  return `${store}: ${message.template.replaceAll('_', ' ')}`
}

/**
 * Prints SMS messages instead of sending them. Development only, like the
 * email log channel; it never counts as a real SMS app in production.
 */
export class LogSmsChannel implements NotificationChannel {
  readonly id = 'log-sms'
  readonly label = 'SMS log (development only)'
  readonly requires = 'phone' as const
  readonly medium = 'sms' as const

  constructor(private readonly write: (line: string) => void = console.log) {}

  async send(message: Message): Promise<SendResult> {
    if (!message.to.phone) return { ok: false, error: 'recipient has no phone' }
    this.write(`[sms] to=${message.to.phone} ${smsText(message)}`)
    return { ok: true, providerRef: `log_sms_${message.template}_${Date.now()}` }
  }
}

export const logSmsChannelFactory: NotificationChannelFactory<LogSmsChannelConfig> = {
  id: 'log-sms',
  label: 'SMS log (development only)',
  fields: [],
  validateConfig: () => ({ ok: true, config: {} }),
  create: () => new LogSmsChannel(),
}
