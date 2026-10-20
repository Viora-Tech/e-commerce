/** SOURCE OF TRUTH: platform email account — WHAT: the one account every store sends through (SES or Resend, optional fallback), built from env / WHY: merchants never need their own email provider */
import { loadPlatformEmailEnv, type PlatformEmailEnv } from '@commerce/config'
import { type NotificationChannel, withFallback } from '@commerce/notifications'
import { ResendChannel } from '@commerce/notifications-resend'
import {
  type SenderIdentityProvider,
  SesChannel,
  type SesClientLike,
  SesIdentityProvider,
} from '@commerce/notifications-ses'
import type { ChosenSender } from './client'
import { createDevSenderIdentityProvider } from './dev-provider'

/** From-header formatting (quoting, encoded-words), shared with the SES channel. */
export { formatMailbox } from '@commerce/notifications-ses'

/** The notification channel id the platform sender records against. */
const PLATFORM_EMAIL_CHANNEL = 'platform_email'
const PLATFORM_EMAIL_LABEL = 'Email (sent by the platform)'

export type PlatformEmail = {
  /** The platform's own sender; a placeholder on the platform domain in development. */
  fromEmail: string
  fromName: string
  /** Holds the stores' sender domains. */
  identities: SenderIdentityProvider
  /** Domains no store may claim (the platform's own and its sender's). */
  reservedDomains: string[]
  /**
   * Sending through the platform account. Null when it is not configured
   * (development): stores then need their own email app, as before.
   */
  transport: {
    fromEmail: string
    fromName: string
    channel(sender: ChosenSender): NotificationChannel
  } | null
}

/** Test seams: a mocked fetch for Resend and a recorder for SES. Never set in the apps. */
export type PlatformEmailOptions = {
  resendFetch?: typeof fetch | undefined
  sesClient?: SesClientLike | undefined
}

type Provider = 'ses' | 'resend'
type SesCreds = { region: string; accessKeyId: string; secretAccessKey: string }

/**
 * Stores' sender domains are SES identities only (Resend's DNS records differ and the
 * domain would need verifying at both). Without SES keys the Sender email card cannot
 * start one, and says why; the platform address still sends through Resend.
 */
function sesOnlyIdentities(): SenderIdentityProvider {
  return {
    id: 'none',
    region: 'ap-south-1',
    async create() {
      throw new Error(
        'store sender domains need the Amazon SES keys (SES_*); Resend sends the platform address only',
      )
    },
    get: async () => null,
    setMailFrom: async () => false,
    remove: async () => undefined,
  }
}

/** Fail at first use with the keys that are missing, never with a half-working sender. */
function requireKeys(
  provider: Provider,
  role: string,
  ses: SesCreds | null,
  resendKey: string | undefined,
) {
  if (provider === 'ses' && !ses) {
    throw new Error(`${role}=ses needs SES_REGION, SES_ACCESS_KEY_ID and SES_SECRET_ACCESS_KEY`)
  }
  if (provider === 'resend' && !resendKey) throw new Error(`${role}=resend needs RESEND_API_KEY`)
}

/**
 * Build the platform account from env. `dev` never sends and checks domains offline.
 * Exported for tests; the apps use `getPlatformEmail`.
 */
export function platformEmailFromEnv(
  env: PlatformEmailEnv,
  options: PlatformEmailOptions = {},
): PlatformEmail {
  const senderDomain = env.PLATFORM_EMAIL_FROM?.split('@')[1]?.toLowerCase()
  const reservedDomains = [...env.PLATFORM_DOMAINS, ...(senderDomain ? [senderDomain] : [])]
  const ses: SesCreds | null =
    env.SES_REGION && env.SES_ACCESS_KEY_ID && env.SES_SECRET_ACCESS_KEY
      ? {
          region: env.SES_REGION,
          accessKeyId: env.SES_ACCESS_KEY_ID,
          secretAccessKey: env.SES_SECRET_ACCESS_KEY,
        }
      : null
  const fromName = env.PLATFORM_EMAIL_NAME
  const provider = env.SENDER_EMAIL_PROVIDER
  if (provider === 'dev') {
    return {
      fromEmail: env.PLATFORM_EMAIL_FROM ?? `no-reply@${env.PLATFORM_DOMAINS[0] ?? 'localhost'}`,
      fromName,
      identities: createDevSenderIdentityProvider(),
      reservedDomains,
      transport: null,
    }
  }
  const resendKey = env.RESEND_API_KEY
  requireKeys(provider, 'SENDER_EMAIL_PROVIDER', ses, resendKey)
  const fallback =
    env.SENDER_EMAIL_FALLBACK === 'none' || env.SENDER_EMAIL_FALLBACK === provider
      ? null
      : env.SENDER_EMAIL_FALLBACK
  if (fallback) requireKeys(fallback, 'SENDER_EMAIL_FALLBACK', ses, resendKey)
  if (!env.PLATFORM_EMAIL_FROM) {
    throw new Error(`SENDER_EMAIL_PROVIDER=${provider} needs PLATFORM_EMAIL_FROM`)
  }
  const fromEmail = env.PLATFORM_EMAIL_FROM
  const meta = { id: PLATFORM_EMAIL_CHANNEL, label: PLATFORM_EMAIL_LABEL }

  /**
   * One provider's channel. The primary records as `platform_email`; a fallback keeps its
   * own id (`ses` / `resend`), which prefixes the provider reference when it delivers.
   */
  const via = (p: Provider, s: ChosenSender, primary: boolean): NotificationChannel => {
    const mailbox = { fromEmail: s.fromEmail, fromName: s.fromName, replyTo: s.replyTo }
    const ids = primary ? meta : {}
    if (p === 'ses' && ses) return new SesChannel({ ...ses, ...mailbox }, options.sesClient, ids)
    return new ResendChannel(
      { apiKey: resendKey as string, ...mailbox },
      { ...ids, fetch: options.resendFetch },
    )
  }
  /** The platform address, with replies going to the shop's own address. */
  const asPlatform = (s: ChosenSender): ChosenSender =>
    s.using === 'platform'
      ? s
      : { fromName: s.fromName, fromEmail, replyTo: s.fromEmail, using: 'platform' }

  const channel = (sender: ChosenSender): NotificationChannel => {
    // A store's own domain is an SES identity, so only SES may send as it. Its fallback
    // sends from the platform address instead (Reply-To the shop), as before verification.
    if (sender.using === 'own' && ses) {
      const primary = via('ses', sender, true)
      // With a fallback configured, the backup for SES is Resend (the provider or the fallback).
      return fallback ? withFallback(primary, via('resend', asPlatform(sender), false)) : primary
    }
    const s = asPlatform(sender)
    const primary = via(provider, s, true)
    return fallback ? withFallback(primary, via(fallback, s, false)) : primary
  }

  return {
    fromEmail,
    fromName,
    identities: ses
      ? new SesIdentityProvider({ ...ses, configurationSetName: env.SES_CONFIGURATION_SET })
      : sesOnlyIdentities(),
    reservedDomains,
    transport: { fromEmail, fromName, channel },
  }
}

let cached: PlatformEmail | undefined

/** The process's platform account, read from `process.env` once. */
export function getPlatformEmail(): PlatformEmail {
  cached ??= platformEmailFromEnv(loadPlatformEmailEnv(process.env))
  return cached
}
