import { store } from '@commerce/db'
import type { NotificationChannel, NotificationRegistry } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { storeNotificationChannels } from '../sender-email/channels'

export type DeliverCodeOptions = {
  registry: NotificationRegistry
  settingsSecret: string
  /** Override channel resolution; tests inject fakes here. */
  channels?: NotificationChannel[] | undefined
}

/**
 * Send a sign-in code through the store's enabled email channels. Synchronous on
 * purpose (a queued code could arrive after it expired). Returns how many
 * channels accepted it; zero means the store has no working email channel.
 */
export async function deliverLoginCode(
  ctx: StoreContext,
  input: { email: string; code: string },
  opts: DeliverCodeOptions,
): Promise<number> {
  const [s] = await ctx.tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId))
  const channels =
    opts.channels ??
    (await storeNotificationChannels(ctx.tx, ctx.storeId, {
      registry: opts.registry,
      settingsSecret: opts.settingsSecret,
    }))
  let sent = 0
  for (const channel of channels) {
    if (channel.requires !== 'email') continue
    const r = await channel.send({
      to: { email: input.email },
      template: 'login_code',
      data: {
        storeName: s?.name ?? '',
        customerName: '',
        totalLabel: '',
        lines: [],
        paymentMethodLabel: '',
        code: input.code,
      },
    })
    if (r.ok) sent += 1
  }
  return sent
}
