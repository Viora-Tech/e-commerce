import {
  GetAccountCommand,
  GetConfigurationSetCommand,
  GetEmailIdentityCommand,
} from '@aws-sdk/client-sesv2'
import { makeSesClient } from './client'
import type { SesConfig } from './ses'

/**
 * What "Check connection" found on a store's own Amazon SES account. Errors mean email will not
 * go out as set up; warnings mean it goes out with a limit (sandbox).
 */
export type SesCheckIssue =
  /** AWS refused the access key or secret. */
  | 'bad_keys'
  /** The keys work but may not read the account (the IAM policy lacks `ses:Get*`). */
  | 'no_permission'
  /** SES could not be reached in that region. */
  | 'unreachable'
  /** Amazon paused sending on the account. */
  | 'sending_paused'
  /** Sandbox: only verified addresses receive mail until Amazon grants production access. */
  | 'sandbox'
  /** Neither the From address nor its domain is verified in this region. */
  | 'from_not_verified'
  /** The configuration set named for bounces does not exist in this region. */
  | 'config_set_missing'

export type SesCheck = { errors: SesCheckIssue[]; warnings: SesCheckIssue[] }

/** The three read-only calls the check makes, so tests can answer them. */
export type SesCheckClientLike = {
  send(
    command: GetAccountCommand | GetEmailIdentityCommand | GetConfigurationSetCommand,
  ): Promise<unknown>
}

const nameOf = (err: unknown) =>
  err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : ''

const BAD_KEYS = new Set([
  'UnrecognizedClientException',
  'InvalidClientTokenId',
  'SignatureDoesNotMatch',
  'InvalidSignatureException',
  'IncompleteSignature',
  'ExpiredTokenException',
])

/** A thrown SDK error as the one issue it stands for. */
function issueOf(err: unknown): SesCheckIssue {
  const name = nameOf(err)
  if (BAD_KEYS.has(name)) return 'bad_keys'
  if (name === 'AccessDeniedException' || name === 'AccessDenied') return 'no_permission'
  return 'unreachable'
}

/** Whether SES may send as this identity (an address or a domain); false when it is unknown. */
async function verified(client: SesCheckClientLike, identity: string): Promise<boolean> {
  try {
    const r = (await client.send(new GetEmailIdentityCommand({ EmailIdentity: identity }))) as {
      VerifiedForSendingStatus?: boolean
    }
    return r.VerifiedForSendingStatus === true
  } catch (err) {
    if (nameOf(err) === 'NotFoundException') return false
    throw err
  }
}

/**
 * Checks a store's own SES account with read-only calls: the keys, whether sending is on, sandbox,
 * whether the From address (or its domain) is verified, and the configuration set when one is
 * named. Never throws.
 */
export async function checkSesSetup(
  config: SesConfig,
  client: SesCheckClientLike = makeSesClient({ ...config, maxAttempts: 1 }),
): Promise<SesCheck> {
  const errors: SesCheckIssue[] = []
  const warnings: SesCheckIssue[] = []
  try {
    const account = (await client.send(new GetAccountCommand({}))) as {
      ProductionAccessEnabled?: boolean
      SendingEnabled?: boolean
    }
    if (account.SendingEnabled === false) errors.push('sending_paused')
    if (account.ProductionAccessEnabled === false) warnings.push('sandbox')
  } catch (err) {
    // Wrong keys or no network: the other checks would only repeat it.
    return { errors: [issueOf(err)], warnings }
  }
  try {
    const domain = config.fromEmail.split('@')[1] ?? ''
    const ok =
      (await verified(client, config.fromEmail)) || (domain && (await verified(client, domain)))
    if (!ok) errors.push('from_not_verified')
  } catch (err) {
    errors.push(issueOf(err))
  }
  if (config.configurationSetName) {
    try {
      await client.send(
        new GetConfigurationSetCommand({ ConfigurationSetName: config.configurationSetName }),
      )
    } catch (err) {
      errors.push(nameOf(err) === 'NotFoundException' ? 'config_set_missing' : issueOf(err))
    }
  }
  return { errors: [...new Set(errors)], warnings }
}
