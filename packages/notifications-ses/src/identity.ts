import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
} from '@aws-sdk/client-sesv2'
import { makeSesClient } from './client'

/**
 * Sender domains in the platform's one SES account: create a domain identity
 * (Easy DKIM), ask how it is doing, remove it. The platform keeps one identity
 * per store domain; merchants never see or need an AWS account.
 *
 * API shapes checked against the SES v2 reference (CreateEmailIdentity,
 * GetEmailIdentity, DkimAttributes, PutEmailIdentityMailFromAttributes).
 */

export type SenderIdentityStatus = 'pending' | 'verified' | 'failed'

/** Why SES could not verify, in terms the admin turns into plain words. */
export type SenderIdentityError =
  | 'records_not_found'
  | 'wrong_value'
  | 'dns_unreachable'
  | 'provider_error'
  | 'timed_out'

export type SenderIdentityState = {
  status: SenderIdentityStatus
  /** Easy DKIM tokens; each becomes `<token>._domainkey.<domain>` CNAME `<token>.<hostedZone>`. */
  dkimTokens: string[]
  /** `SigningHostedZone`, e.g. `dkim.amazonses.com`. */
  dkimHostedZone: string
  /** Custom MAIL FROM (bounce) subdomain, when set. */
  mailFrom: { domain: string; status: SenderIdentityStatus } | null
  error: SenderIdentityError | null
}

export type SenderIdentityProvider = {
  readonly id: string
  /** AWS region, for the MAIL FROM MX value (`feedback-smtp.<region>.amazonses.com`). */
  readonly region: string
  /**
   * Start verifying a domain. Adopts an identity that already exists only when this
   * platform made it for the same store (a retry after a crash), never one someone
   * else put in the account.
   */
  create(
    domain: string,
    opts: { mailFromDomain: string | null; storeId?: string | undefined },
  ): Promise<SenderIdentityState>
  /** Current state, or null when the identity does not exist. */
  get(domain: string): Promise<SenderIdentityState | null>
  /** Set the custom MAIL FROM subdomain. Never throws: false when SES refused. */
  setMailFrom(domain: string, mailFromDomain: string): Promise<boolean>
  /** Delete the identity, only if this platform made it. Missing is fine. */
  remove(domain: string): Promise<void>
}

/** The four SDK calls we make, so tests can swap the client for a recorder. */
export type SesIdentityClientLike = {
  send(
    command:
      | CreateEmailIdentityCommand
      | GetEmailIdentityCommand
      | DeleteEmailIdentityCommand
      | PutEmailIdentityMailFromAttributesCommand,
  ): Promise<unknown>
}

export type SesIdentityConfig = {
  region: string
  accessKeyId: string
  secretAccessKey: string
  /** Default configuration set for every store identity (bounce and complaint events). */
  configurationSetName?: string | undefined
}

/** Documented default when SES leaves `SigningHostedZone` out. */
const DEFAULT_DKIM_ZONE = 'dkim.amazonses.com'

type RawDkim = { Status?: string; Tokens?: string[]; SigningHostedZone?: string }
type RawIdentity = {
  DkimAttributes?: RawDkim
  VerifiedForSendingStatus?: boolean
  VerificationStatus?: string
  VerificationInfo?: { ErrorType?: string }
  MailFromAttributes?: { MailFromDomain?: string; MailFromDomainStatus?: string }
  Tags?: { Key?: string; Value?: string }[]
}

const MANAGED_TAG = { Key: 'managed-by', Value: 'waimers-commerce' }
const STORE_TAG = 'store-id'

const tagValue = (raw: RawIdentity, key: string): string | undefined =>
  raw.Tags?.find((t) => t.Key === key)?.Value

/**
 * An identity this platform created (and, when both say, for this store). An
 * identity someone else added to the SES account, e.g. another product's
 * verified domain, is never adopted or deleted (audit 2026-09-28).
 */
function isOurs(raw: RawIdentity, storeId: string | undefined): boolean {
  if (tagValue(raw, MANAGED_TAG.Key) !== MANAGED_TAG.Value) return false
  const owner = tagValue(raw, STORE_TAG)
  return !storeId || !owner || owner === storeId
}

const errorName = (err: unknown) =>
  err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : ''

/** SES DKIM / verification / MAIL FROM status strings to ours. */
function statusOf(raw: string | undefined, verified: boolean | undefined): SenderIdentityStatus {
  if (verified || raw === 'SUCCESS' || raw === 'Success') return 'verified'
  if (raw === 'FAILED' || raw === 'Failed') return 'failed'
  // PENDING, TEMPORARY_FAILURE and NOT_STARTED all mean "keep waiting".
  return 'pending'
}

/** `VerificationInfo.ErrorType` to a reason the merchant can act on. */
function errorOf(raw: RawIdentity, status: SenderIdentityStatus): SenderIdentityError | null {
  const t = raw.VerificationInfo?.ErrorType
  if (t === 'HOST_NOT_FOUND' || t === 'TYPE_NOT_FOUND') return 'records_not_found'
  if (t === 'INVALID_VALUE') return 'wrong_value'
  if (t === 'DNS_SERVER_ERROR') return 'dns_unreachable'
  if (t === 'SERVICE_ERROR') return 'provider_error'
  if (status === 'failed') return 'timed_out'
  return null
}

/** Exported for tests: the SDK response shape to our state. */
export function identityState(raw: RawIdentity): SenderIdentityState {
  const dkim = raw.DkimAttributes ?? {}
  const status = statusOf(dkim.Status ?? raw.VerificationStatus, raw.VerifiedForSendingStatus)
  const mf = raw.MailFromAttributes
  return {
    status,
    dkimTokens: dkim.Tokens ?? [],
    dkimHostedZone: dkim.SigningHostedZone || DEFAULT_DKIM_ZONE,
    mailFrom: mf?.MailFromDomain
      ? { domain: mf.MailFromDomain, status: statusOf(mf.MailFromDomainStatus, false) }
      : null,
    error: errorOf(raw, status),
  }
}

/** Domain identities in the platform's SES account. */
export class SesIdentityProvider implements SenderIdentityProvider {
  readonly id = 'ses'
  readonly region: string
  private readonly client: SesIdentityClientLike

  constructor(
    private readonly config: SesIdentityConfig,
    client?: SesIdentityClientLike,
  ) {
    this.region = config.region
    this.client = client ?? makeSesClient(config)
  }

  async create(
    domain: string,
    opts: { mailFromDomain: string | null; storeId?: string | undefined },
  ): Promise<SenderIdentityState> {
    try {
      await this.client.send(
        new CreateEmailIdentityCommand({
          EmailIdentity: domain,
          // No DkimSigningAttributes: SES answers with Easy DKIM tokens.
          ...(this.config.configurationSetName
            ? { ConfigurationSetName: this.config.configurationSetName }
            : {}),
          Tags: [MANAGED_TAG, ...(opts.storeId ? [{ Key: STORE_TAG, Value: opts.storeId }] : [])],
        }),
      )
    } catch (err) {
      if (errorName(err) !== 'AlreadyExistsException') throw err
      const existing = await this.getRaw(domain)
      if (!existing || !isOurs(existing, opts.storeId)) {
        throw new Error(`${domain} is already set up in the email account by someone else`)
      }
    }
    if (opts.mailFromDomain) await this.setMailFrom(domain, opts.mailFromDomain)
    const state = await this.get(domain)
    if (!state) throw new Error(`SES identity ${domain} vanished right after it was created`)
    return state
  }

  async get(domain: string): Promise<SenderIdentityState | null> {
    const raw = await this.getRaw(domain)
    return raw ? identityState(raw) : null
  }

  private async getRaw(domain: string): Promise<RawIdentity | null> {
    try {
      return (await this.client.send(
        new GetEmailIdentityCommand({ EmailIdentity: domain }),
      )) as RawIdentity
    } catch (err) {
      if (errorName(err) === 'NotFoundException') return null
      throw err
    }
  }

  async setMailFrom(domain: string, mailFromDomain: string): Promise<boolean> {
    try {
      await this.client.send(
        new PutEmailIdentityMailFromAttributesCommand({
          EmailIdentity: domain,
          MailFromDomain: mailFromDomain,
          // Until the MX record is found, fall back to amazonses.com rather than bounce the mail.
          BehaviorOnMxFailure: 'USE_DEFAULT_VALUE',
        }),
      )
      return true
    } catch {
      return false
    }
  }

  async remove(domain: string): Promise<void> {
    const existing = await this.getRaw(domain)
    if (!existing || !isOurs(existing, undefined)) return
    try {
      await this.client.send(new DeleteEmailIdentityCommand({ EmailIdentity: domain }))
    } catch (err) {
      if (errorName(err) !== 'NotFoundException') throw err
    }
  }
}
