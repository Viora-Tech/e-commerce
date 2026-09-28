/** SOURCE OF TRUTH: shopper identity linking — WHAT: which customer a Google / Apple / Facebook / Truecaller sign-in becomes (the identity already linked, a customer with the same verified email or phone, a new customer, or "confirm your email first"), and the linked identities a shopper sees and removes / WHY: one person must stay one customer however they sign in, and an email the provider did not verify must never open someone else's account */
import { customer, customerIdentity, type SHOPPER_IDENTITY_PROVIDERS } from '@commerce/db'
import { and, desc, eq, isNull } from 'drizzle-orm'
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
  | { action: 'no_email' }
  | { action: 'conflict' }

/**
 * The linking rule, pure. An identity seen before signs in as its customer. Otherwise
 * it joins an existing customer only through something the provider verified: a mobile
 * (Truecaller) or a verified email. An unverified email never links and never creates
 * a customer carrying that email (the real owner would later sign in to it); the
 * shopper confirms it with an email code first.
 */
export function decideLink(identity: ShopperIdentity, facts: LinkFacts): LinkDecision {
  if (facts.byIdentity) {
    if (facts.linkTo && facts.linkTo !== facts.byIdentity) return { action: 'conflict' }
    return { action: 'sign_in', customerId: facts.byIdentity }
  }
  if (facts.linkTo) return { action: 'link', customerId: facts.linkTo }
  if (identity.mobile) {
    return facts.byPhone ? { action: 'link', customerId: facts.byPhone } : { action: 'create' }
  }
  if (identity.email && identity.emailVerified) {
    return facts.byEmail ? { action: 'link', customerId: facts.byEmail } : { action: 'create' }
  }
  if (identity.email) return { action: 'verify_email', email: identity.email }
  return { action: 'no_email' }
}

export type ResolveResult =
  | { kind: 'signed_in'; customerId: string; created: boolean }
  | { kind: 'verify_email'; email: string }
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
    const [row] = await ctx.tx
      .select({ id: customer.id })
      .from(customer)
      .where(
        and(
          eq(customer.phoneIndex, phoneBlindIndex(identity.mobile, opts.secret)),
          isNull(customer.anonymisedAt),
        ),
      )
      .orderBy(desc(customer.updatedAt))
      .limit(1)
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
      return { kind: 'signed_in', customerId: decision.customerId, created: false }
    case 'create': {
      const values = identity.mobile
        ? {
            storeId: ctx.storeId,
            email: null,
            phone: encryptCustomerPhone(identity.mobile, opts.secret).cipher,
            phoneIndex: phoneBlindIndex(identity.mobile, opts.secret),
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
