/** SOURCE OF TRUTH: platform email account — WHAT: the one SES account every store sends through, built from env / WHY: merchants never need their own AWS account */
import { loadPlatformEmailEnv, type PlatformEmailEnv } from '@commerce/config'
import type { NotificationChannel } from '@commerce/notifications'
import {
  type SenderIdentityProvider,
  SesChannel,
  SesIdentityProvider,
} from '@commerce/notifications-ses'
import type { ChosenSender } from './client'
import { createDevSenderIdentityProvider } from './dev-provider'

/** From-header formatting (quoting, encoded-words), shared with the SES channel. */
export { formatMailbox } from '@commerce/notifications-ses'

/** The notification channel id the platform sender records against. */
const PLATFORM_EMAIL_CHANNEL = 'platform_email'

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

/** Build the platform account from env. `dev` never sends and checks domains offline. */
function platformEmailFromEnv(env: PlatformEmailEnv): PlatformEmail {
  const senderDomain = env.PLATFORM_EMAIL_FROM?.split('@')[1]?.toLowerCase()
  const reservedDomains = [...env.PLATFORM_DOMAINS, ...(senderDomain ? [senderDomain] : [])]
  const creds =
    env.SES_REGION && env.SES_ACCESS_KEY_ID && env.SES_SECRET_ACCESS_KEY
      ? {
          region: env.SES_REGION,
          accessKeyId: env.SES_ACCESS_KEY_ID,
          secretAccessKey: env.SES_SECRET_ACCESS_KEY,
        }
      : null
  const fromName = env.PLATFORM_EMAIL_NAME
  if (env.SENDER_EMAIL_PROVIDER !== 'ses') {
    return {
      fromEmail: env.PLATFORM_EMAIL_FROM ?? `no-reply@${env.PLATFORM_DOMAINS[0] ?? 'localhost'}`,
      fromName,
      identities: createDevSenderIdentityProvider(),
      reservedDomains,
      transport: null,
    }
  }
  if (!creds || !env.PLATFORM_EMAIL_FROM) {
    throw new Error(
      'SENDER_EMAIL_PROVIDER=ses needs SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY and PLATFORM_EMAIL_FROM',
    )
  }
  const fromEmail = env.PLATFORM_EMAIL_FROM
  return {
    fromEmail,
    fromName,
    identities: new SesIdentityProvider({
      ...creds,
      configurationSetName: env.SES_CONFIGURATION_SET,
    }),
    reservedDomains,
    transport: {
      fromEmail,
      fromName,
      channel: (sender) =>
        new SesChannel(
          {
            ...creds,
            fromEmail: sender.fromEmail,
            fromName: sender.fromName,
            replyTo: sender.replyTo,
          },
          undefined,
          { id: PLATFORM_EMAIL_CHANNEL, label: 'Email (sent by the platform)' },
        ),
    },
  }
}

let cached: PlatformEmail | undefined

/** The process's platform account, read from `process.env` once. */
export function getPlatformEmail(): PlatformEmail {
  cached ??= platformEmailFromEnv(loadPlatformEmailEnv(process.env))
  return cached
}
