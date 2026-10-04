import { store } from '@commerce/db'
import type { NotificationChannel, NotificationRegistry } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { storeNotificationChannels } from '../sender-email/channels'
import { getPlatformEmail, type PlatformEmail } from '../sender-email/platform'

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

/**
 * Send a one-time sign-in link (magic link) through the store's email channels,
 * straight away like the code. Returns how many channels accepted it.
 */
export async function deliverLoginLink(
  ctx: StoreContext,
  input: { email: string; url: string },
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
      template: 'login_link',
      data: {
        storeName: s?.name ?? '',
        customerName: '',
        totalLabel: '',
        lines: [],
        paymentMethodLabel: '',
        actionUrl: input.url,
      },
    })
    if (r.ok) sent += 1
  }
  return sent
}

/** What `deliverPlatformLoginCode` sends through; `getPlatformEmail()` in the apps, a fake in tests. */
export type PlatformCodeSender = Pick<PlatformEmail, 'transport'>

/**
 * Send a merchant's admin sign-in code through the platform email account (the one SES account
 * every store sends through). Merchants sign in before any store exists, so there is no store
 * channel to use. Returns false when the platform account is not configured (development), and
 * false when the provider refuses; the caller decides whether to fail the sign-in.
 */
export async function deliverPlatformLoginCode(
  input: { email: string; code: string },
  platform: PlatformCodeSender = getPlatformEmail(),
): Promise<boolean> {
  const transport = platform.transport
  if (!transport) return false
  const channel = transport.channel({
    fromEmail: transport.fromEmail,
    fromName: transport.fromName,
    replyTo: undefined,
    using: 'platform',
  })
  const r = await channel.send({
    to: { email: input.email },
    template: 'login_code',
    data: {
      storeName: transport.fromName,
      customerName: '',
      totalLabel: '',
      lines: [],
      paymentMethodLabel: '',
      code: input.code,
    },
  })
  return r.ok
}
