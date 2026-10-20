import type { MarketingSend, Message, NotificationChannel, SendResult } from './types'

/**
 * One channel that tries `primary`, and `secondary` only when the primary failed with a
 * `retryable` error (the provider was down, throttled or paused, not the message being
 * bad). A message the primary refused outright is never sent twice. Keeps the primary's
 * id and label, so the notification log reads the same whichever provider carried it;
 * the provider reference is prefixed with the secondary's id when it was the one.
 */
export function withFallback(
  primary: NotificationChannel,
  secondary: NotificationChannel,
): NotificationChannel {
  const run = async (
    first: () => Promise<SendResult>,
    second: () => Promise<SendResult>,
  ): Promise<SendResult> => {
    const r = await first()
    if (r.ok || !r.retryable) return r
    const b = await second()
    if (b.ok) return { ok: true, providerRef: `${secondary.id}:${b.providerRef}` }
    return { ...b, error: `${r.error}; fallback ${secondary.id}: ${b.error}` }
  }
  const primaryMarketing = primary.sendMarketing?.bind(primary)
  const secondaryMarketing = secondary.sendMarketing?.bind(secondary)
  return {
    id: primary.id,
    label: primary.label,
    requires: primary.requires,
    send: (message: Message) =>
      run(
        () => primary.send(message),
        () => secondary.send(message),
      ),
    ...(primaryMarketing
      ? {
          sendMarketing: (message: MarketingSend) =>
            secondaryMarketing
              ? run(
                  () => primaryMarketing(message),
                  () => secondaryMarketing(message),
                )
              : primaryMarketing(message),
        }
      : {}),
  }
}
