/** SOURCE OF TRUTH: shopper identity linking — WHAT: which customer a Google / Apple / Facebook / Truecaller sign-in becomes (the identity already linked, a customer with the same verified email or phone, a new customer, or "confirm your email first"), and the linked identities a shopper sees and removes / WHY: one person must stay one customer however they sign in, and an email the provider did not verify must never open someone else's account */
import { customer, customerIdentity, type SHOPPER_IDENTITY_PROVIDERS } from '@commerce/db'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { phoneSignInMatch } from '../accounts/phone-proof'
import type { StoreContext } from '../context'
import { encryptCustomerPhone, phoneBlindIndex } from '../customers/phone-crypto'

export type IdentityProvider = (typeof SHOPPER_IDENTITY_PROVIDERS)[number]

/** What a provider told us about the shopper. */
export type ShopperIdentity = {
  provider: IdentityProvider
  /** The provider's stable account id (Google/Apple `sub`, Facebook id, Truecaller number). */
  subject: string
  email: string | null
  /** The provider vouches that the shopper owns `email`. */
  emailVerified: boolean
  name: string | null
  /** A 10 digit Indian mobile the provider verified (Truecaller). */
  mobile?: string | null | undefined
}

export type LinkFacts = {
  /** Customer this identity is already linked to. */
  byIdentity: string | null
  /** Customer with the same email (only looked up when the email is verified). */
  byEmail: string | null
  /** Customer with the same verified mobile. */
  byPhone: string | null
  /** A signed-in shopper connecting this provider to their own account. */
  linkTo: string | null
}

export type LinkDecision =
  | { action: 'sign_in'; customerId: string }
  | { action: 'link'; customerId: string }
  | { action: 'create' }
  | { action: 'verify_email'; email: string }
  | { action: 'verify_phone'; customerId: string }
  | { action: 'no_email' }
  | { action: 'conflict' }

/**
 * The linking rule, pure. An identity seen before signs in as its customer. Otherwise
 * it joins an existing customer only through something the provider verified: a mobile
 * (Truecaller) or a verified email. An unverified email never links and never creates
 * a customer carrying that email (the real owner would later sign in to it); the
 * shopper confirms it with an email code first.
 *
 * A Truecaller number that belongs to an existing customer links only after a phone code
 * (`verify_phone`, security audit D-03): Truecaller's consent screen can be opened on
 * someone else's request (the nonce belongs to whoever started it, not to the phone), so a
 * phishing page could otherwise walk into an existing account with one tap.
 */
export function decideLink(identity: ShopperIdentity, facts: LinkFacts): LinkDecision {
  if (facts.byIdentity) {
    if (facts.linkTo && facts.linkTo !== facts.byIdentity) return { action: 'conflict' }
    return { action: 'sign_in', customerId: facts.byIdentity }
  }
  if (facts.linkTo) return { action: 'link', customerId: facts.linkTo }
  if (identity.mobile) {
    return facts.byPhone
      ? { action: 'verify_phone', customerId: facts.byPhone }
      : { action: 'create' }
  }
  if (identity.email && identity.emailVerified) {
    return facts.byEmail ? { action: 'link', customerId: facts.byEmail } : { action: 'create' }
  }
  if (identity.email) return { action: 'verify_email', email: identity.email }
  return { action: 'no_email' }
}

/**
 * "Connect" from a signed-in account page: may this provider account be added to
 * `customerId`? Nothing is written here. The platform login domain cannot tell whose
 * browser finished the provider round trip (a forwarded start link would finish in the
 * victim's), so the link is only made on the store's own domain, after the hand-off's
 * browser check, for the customer signed in there (`linkIdentity`).
 */
export function connectDecision(
  linkedTo: string | null,
  customerId: string,
): 'link' | 'already' | 'conflict' {
  if (!linkedTo) return 'link'
  return linkedTo === customerId ? 'already' : 'conflict'
}

/** `connectDecision` for this identity, reading who (if anyone) it is linked to now. */
export async function planConnect(
  ctx: StoreContext,
  identity: ShopperIdentity,
  customerId: string,
): Promise<'link' | 'already' | 'conflict'> {
  const [linked] = await ctx.tx
    .select({ customerId: customerIdentity.customerId })
    .from(customerIdentity)
    .where(
      and(
        eq(customerIdentity.provider, identity.provider),
        eq(customerIdentity.subject, identity.subject),
      ),
    )
  return connectDecision(await activeCustomer(ctx, linked?.customerId), customerId)
}

export type ResolveResult =
  | { kind: 'signed_in'; customerId: string; created: boolean }
  | { kind: 'verify_email'; email: string }
  /** A provider-verified mobile of an existing customer: link only after a phone code. */
  | { kind: 'verify_phone'; customerId: string }
  | { kind: 'no_email' }
  | { kind: 'conflict' }

const normaliseEmail = (email: string | null): string | null => {
  const e = email?.trim().toLowerCase()
  return e && e.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(e) ? e : null
}

async function activeCustomer(ctx: StoreContext, id: string | undefined): Promise<string | null> {
  if (!id) return null
  const [row] = await ctx.tx
    .select({ id: customer.id })
    .from(customer)
    .where(and(eq(customer.id, id), isNull(customer.anonymisedAt)))
  return row?.id ?? null
}

/** Attach an identity to a customer (idempotent) and fill in a missing name. */
export async function linkIdentity(
  ctx: StoreContext,
  customerId: string,
  identity: ShopperIdentity,
  now: Date = new Date(),
): Promise<void> {
  await ctx.tx
    .insert(customerIdentity)
    .values({
      storeId: ctx.storeId,
      customerId,
      provider: identity.provider,
      subject: identity.subject,
      email: normaliseEmail(identity.email),
      createdAt: now,
      lastUsedAt: now,
    })
    .onConflictDoNothing({
      target: [customerIdentity.storeId, customerIdentity.provider, customerIdentity.subject],
    })
  if (identity.name) {
    await ctx.tx
      .update(customer)
      .set({ name: identity.name.slice(0, 200), updatedAt: now })
      .where(and(eq(customer.id, customerId), isNull(customer.name)))
  }
}

/**
 * Find or create the customer for a provider sign-in, per `decideLink`. `secret` is
 * SETTINGS_SECRET (phone blind index and encryption).
 */
export async function resolveShopperIdentity(
  ctx: StoreContext,
  raw: ShopperIdentity,
  opts: { secret: string; linkTo?: string | null | undefined; now?: Date },
): Promise<ResolveResult> {
  const now = opts.now ?? new Date()
  const identity = { ...raw, email: normaliseEmail(raw.email) }
  const [linked] = await ctx.tx
    .select({ customerId: customerIdentity.customerId })
    .from(customerIdentity)
    .where(
      and(
        eq(customerIdentity.provider, identity.provider),
        eq(customerIdentity.subject, identity.subject),
      ),
    )
  const byIdentity = await activeCustomer(ctx, linked?.customerId)
  let byEmail: string | null = null
  if (!byIdentity && identity.email && identity.emailVerified) {
    const [row] = await ctx.tx
      .select({ id: customer.id })
      .from(customer)
      .where(and(eq(customer.email, identity.email), isNull(customer.anonymisedAt)))
    byEmail = row?.id ?? null
  }
  let byPhone: string | null = null
  if (!byIdentity && identity.mobile) {
    // Only a phone proven before (or a phone-only customer) links: `phone-proof.ts`.
    const row = phoneSignInMatch(
      await ctx.tx
        .select({
          id: customer.id,
          email: customer.email,
          phoneVerifiedAt: customer.phoneVerifiedAt,
        })
        .from(customer)
        .where(
          and(
            eq(customer.phoneIndex, phoneBlindIndex(identity.mobile, opts.secret)),
            isNull(customer.anonymisedAt),
          ),
        )
        .orderBy(desc(customer.updatedAt))
        .limit(20),
    )
    byPhone = row?.id ?? null
  }
  const linkTo = await activeCustomer(ctx, opts.linkTo ?? undefined)
  const decision = decideLink(identity, { byIdentity, byEmail, byPhone, linkTo })

  switch (decision.action) {
    case 'sign_in':
      await ctx.tx
        .update(customerIdentity)
        .set({ lastUsedAt: now })
        .where(
          and(
            eq(customerIdentity.provider, identity.provider),
            eq(customerIdentity.subject, identity.subject),
          ),
        )
      return { kind: 'signed_in', customerId: decision.customerId, created: false }
    case 'link':
      // A stale link to an erased customer gives way to the live one.
      if (linked && !byIdentity) {
        await ctx.tx
          .delete(customerIdentity)
          .where(
            and(
              eq(customerIdentity.provider, identity.provider),
              eq(customerIdentity.subject, identity.subject),
            ),
          )
      }
      await linkIdentity(ctx, decision.customerId, identity, now)
      if (identity.mobile && decision.customerId === byPhone) {
        // The signed-in shopper connected Truecaller for the number on their account.
        await ctx.tx
          .update(customer)
          .set({ phoneVerifiedAt: now })
          .where(eq(customer.id, decision.customerId))
      }
      return { kind: 'signed_in', customerId: decision.customerId, created: false }
    case 'verify_phone':
      return { kind: 'verify_phone', customerId: decision.customerId }
    case 'create': {
      const values = identity.mobile
        ? {
            storeId: ctx.storeId,
            email: null,
            phone: encryptCustomerPhone(identity.mobile, opts.secret).cipher,
            phoneIndex: phoneBlindIndex(identity.mobile, opts.secret),
            phoneVerifiedAt: now,
          }
        : { storeId: ctx.storeId, email: identity.email }
      const [row] = await ctx.tx.insert(customer).values(values).returning({ id: customer.id })
      const customerId = row?.id as string
      if (linked) {
        await ctx.tx
          .delete(customerIdentity)
          .where(
            and(
              eq(customerIdentity.provider, identity.provider),
              eq(customerIdentity.subject, identity.subject),
            ),
          )
      }
      await linkIdentity(ctx, customerId, identity, now)
      return { kind: 'signed_in', customerId, created: true }
    }
    case 'verify_email':
      return { kind: 'verify_email', email: decision.email }
    case 'no_email':
      return { kind: 'no_email' }
    case 'conflict':
      return { kind: 'conflict' }
  }
}

export type LinkedIdentity = {
  id: string
  provider: IdentityProvider
  email: string | null
  createdAt: Date
}

/** The providers a shopper can sign in with, for their account page. */
export async function listCustomerIdentities(
  ctx: StoreContext,
  customerId: string,
): Promise<LinkedIdentity[]> {
  return ctx.tx
    .select({
      id: customerIdentity.id,
      provider: customerIdentity.provider,
      email: customerIdentity.email,
      createdAt: customerIdentity.createdAt,
    })
    .from(customerIdentity)
    .where(eq(customerIdentity.customerId, customerId))
    .orderBy(customerIdentity.createdAt)
}

/** Disconnect one provider from the shopper's own account. */
export async function removeCustomerIdentity(
  ctx: StoreContext,
  customerId: string,
  identityId: string,
): Promise<boolean> {
  const rows = await ctx.tx
    .delete(customerIdentity)
    .where(and(eq(customerIdentity.id, identityId), eq(customerIdentity.customerId, customerId)))
    .returning({ id: customerIdentity.id })
  return rows.length > 0
}
