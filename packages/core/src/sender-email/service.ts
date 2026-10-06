/** SOURCE OF TRUTH: sender email lifecycle — WHAT: claim, verify, re-check and remove a store's sender domain / WHY: one store = one sender domain, never another store's */
import {
  type Db,
  isUniqueViolation,
  type StoreTx,
  senderEmail,
  storesWithSenderEmailChecks,
  withStore,
} from '@commerce/db'
import type { SenderIdentityProvider, SenderIdentityState } from '@commerce/notifications-ses'
import { eq, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'
import {
  MAIL_FROM_SUBDOMAIN,
  parseSenderAddress,
  type SenderAddressError,
  type SenderDnsRecord,
  senderDnsRecords,
} from './client'

export type SenderEmailRow = typeof senderEmail.$inferSelect

export type SenderEmailErrorCode = SenderAddressError | 'domain_taken' | 'provider_failed'

/** A refusal the admin words from `reason`; the message is for logs. */
export class SenderEmailError extends CommerceError {
  readonly reason: SenderEmailErrorCode
  constructor(reason: SenderEmailErrorCode, message: string, storeId?: string, cause?: unknown) {
    super('SENDER_EMAIL', message, { storeId, cause })
    this.reason = reason
  }
}

export type SenderEmailDeps = {
  identities: SenderIdentityProvider
  /** Domains no store may claim (the platform's own). */
  reservedDomains: readonly string[]
  now?: Date | undefined
}

/** What the card shows: the row without the store id, plus the records to add. */
export type SenderEmailView = Omit<SenderEmailRow, 'storeId' | 'provider' | 'dkimTokens'> & {
  records: SenderDnsRecord[]
}

export function senderEmailView(row: SenderEmailRow, region: string): SenderEmailView {
  const { storeId: _s, provider: _p, dkimTokens, ...rest } = row
  return {
    ...rest,
    records: senderDnsRecords({
      domain: row.domain,
      dkimTokens,
      dkimHostedZone: row.dkimHostedZone,
      mailFromDomain: row.mailFromDomain,
      region,
    }),
  }
}

export async function getSenderEmail(tx: StoreTx): Promise<SenderEmailRow | null> {
  const [row] = await tx.select().from(senderEmail)
  return row ?? null
}

/** Another store holds this domain, a parent of it, or a subdomain of it. Never says which store. */
async function domainTaken(tx: StoreTx, domain: string, storeId: string): Promise<boolean> {
  const [r] = await tx.execute<{ taken: boolean }>(
    sql`select sender_domain_taken(${domain}, ${storeId}::uuid) as taken`,
  )
  return r?.taken === true
}

/** The row's columns that mirror what the provider reported. */
function stateColumns(state: SenderIdentityState, now: Date, previous: SenderEmailRow | null) {
  const verified = state.status === 'verified'
  return {
    status: state.status,
    error: verified ? null : state.error,
    dkimTokens: state.dkimTokens,
    dkimHostedZone: state.dkimHostedZone,
    mailFromDomain: state.mailFrom?.domain ?? null,
    mailFromStatus: state.mailFrom?.status ?? null,
    lastCheckedAt: now,
    verifiedAt: verified ? (previous?.verifiedAt ?? now) : null,
    updatedAt: now,
  }
}

async function createIdentity(
  deps: SenderEmailDeps,
  domain: string,
  storeId: string,
): Promise<SenderIdentityState> {
  try {
    return await deps.identities.create(domain, {
      mailFromDomain: `${MAIL_FROM_SUBDOMAIN}.${domain}`,
      storeId,
    })
  } catch (err) {
    throw new SenderEmailError(
      'provider_failed',
      `Could not start verifying ${domain}: ${err instanceof Error ? err.message : err}`,
      storeId,
      err,
    )
  }
}

export type SetSenderEmailInput = { email: string; displayName?: string | null | undefined }

/**
 * Set (or change) the store's sender address. A new domain is claimed for this
 * store (refused when another store holds it or a parent/subdomain of it) and
 * becomes a domain identity; the old domain's identity is removed. Keeping the
 * domain and changing only the name or the part before @ just re-checks it.
 */
export async function setSenderEmail(
  tx: StoreTx,
  storeId: string,
  input: SetSenderEmailInput,
  deps: SenderEmailDeps,
): Promise<SenderEmailRow> {
  const parsed = parseSenderAddress(input.email, deps.reservedDomains)
  if (!parsed.ok) throw new SenderEmailError(parsed.error, `Invalid sender address`, storeId)
  const displayName = input.displayName?.trim().slice(0, 100) || null
  const now = deps.now ?? new Date()
  const current = await getSenderEmail(tx)

  if (current && current.domain === parsed.domain) {
    const state = await deps.identities.get(parsed.domain)
    const fresh = state ?? (await createIdentity(deps, parsed.domain, storeId))
    const [row] = await tx
      .update(senderEmail)
      .set({ email: parsed.email, displayName, ...stateColumns(fresh, now, current) })
      .where(eq(senderEmail.id, current.id))
      .returning()
    if (!row) throw new SenderEmailError('provider_failed', 'sender row vanished', storeId)
    return row
  }

  if (await domainTaken(tx, parsed.domain, storeId)) {
    throw new SenderEmailError('domain_taken', `${parsed.domain} is used by another store`, storeId)
  }
  const state = await createIdentity(deps, parsed.domain, storeId)
  const values = {
    storeId,
    email: parsed.email,
    domain: parsed.domain,
    displayName,
    provider: deps.identities.id,
    createdAt: now,
    ...stateColumns(state, now, null),
  }
  let row: SenderEmailRow | undefined
  try {
    // A savepoint, so a race with another store leaves the outer transaction usable.
    ;[row] = await tx.transaction(async (sp) => {
      if (current) await sp.delete(senderEmail).where(eq(senderEmail.id, current.id))
      return sp.insert(senderEmail).values(values).returning()
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Another store won the race; the identity is theirs now, so it stays.
      throw new SenderEmailError(
        'domain_taken',
        `${parsed.domain} is used by another store`,
        storeId,
      )
    }
    throw err
  }
  if (!row) throw new SenderEmailError('provider_failed', 'sender insert returned nothing', storeId)
  // The old domain is ours alone (unique), so its identity can go.
  if (current) await deps.identities.remove(current.domain).catch(() => undefined)
  return row
}

/**
 * Ask the provider how the domain is doing and record it. A domain SES gave up
 * on (72 hours without the records) is started again, which issues fresh DKIM
 * records; `restarted` tells the card to say so.
 */
export async function checkSenderEmail(
  tx: StoreTx,
  storeId: string,
  deps: SenderEmailDeps & { restartFailed?: boolean | undefined },
): Promise<{ row: SenderEmailRow; restarted: boolean } | null> {
  const current = await getSenderEmail(tx)
  if (!current) return null
  const now = deps.now ?? new Date()
  let state = await deps.identities.get(current.domain)
  let restarted = false
  if (!state) {
    state = await createIdentity(deps, current.domain, storeId)
    restarted = true
  } else if (state.status === 'failed' && deps.restartFailed) {
    await deps.identities.remove(current.domain)
    state = await createIdentity(deps, current.domain, storeId)
    restarted = true
  }
  // SES refuses MAIL FROM on some pending identities; try again once DKIM is through.
  if (state.status === 'verified' && !state.mailFrom) {
    const mailFrom = `${MAIL_FROM_SUBDOMAIN}.${current.domain}`
    if (await deps.identities.setMailFrom(current.domain, mailFrom)) {
      state = { ...state, mailFrom: { domain: mailFrom, status: 'pending' } }
    }
  }
  const [row] = await tx
    .update(senderEmail)
    .set(stateColumns(state, now, current))
    .where(eq(senderEmail.id, current.id))
    .returning()
  if (!row) return null
  return { row, restarted }
}

/** Stop using the address: customer email goes back to the platform sender. */
export async function removeSenderEmail(tx: StoreTx, deps: SenderEmailDeps): Promise<boolean> {
  const current = await getSenderEmail(tx)
  if (!current) return false
  await tx.delete(senderEmail).where(eq(senderEmail.id, current.id))
  await deps.identities.remove(current.domain).catch(() => undefined)
  return true
}

/**
 * The worker's poll: every pending sender, and every verified one due its
 * daily re-check (DKIM records can be deleted later), each in its own store
 * transaction so one failure never blocks the rest.
 */
export async function pollSenderEmails(
  db: Db,
  deps: SenderEmailDeps & { log?: ((message: string) => void) | undefined },
): Promise<{ checked: number; verified: number; failed: number }> {
  const storeIds = await storesWithSenderEmailChecks(db)
  let checked = 0
  let verified = 0
  let failed = 0
  for (const storeId of storeIds) {
    try {
      const r = await withStore(db, storeId, (tx) => checkSenderEmail(tx, storeId, deps))
      checked += 1
      if (r?.row.status === 'verified') verified += 1
    } catch (err) {
      failed += 1
      deps.log?.(
        `[sender-email] check for ${storeId} failed: ${err instanceof Error ? err.message : err}`,
      )
    }
  }
  return { checked, verified, failed }
}
