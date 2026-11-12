/** SOURCE OF TRUTH: staff-created customers — WHAT: `createCustomer`, the one writer behind the admin's "Add customer" (name, email, mobile, optional first address, marketing consent, note, tags), refusing a duplicate email or mobile / WHY: checkout and sign-in create customers on their own paths; a customer typed in by staff must land the same way (encrypted phone, consent history, outbox events) and never split one shopper into two records */
import { customer } from '@commerce/db'
import { and, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { createAddress } from '../accounts/addresses'
import { AddressInputSchema, fieldErrors, normaliseMobile } from '../accounts/schemas'
import type { StoreContext } from '../context'
import type { PrivacyActor } from '../privacy/audit'
import { CONSENT_CHANNELS, type ConsentChannel } from '../privacy/client'
import { setMarketingConsent } from '../privacy/marketing-consent'
import { noteCustomerTagsChanged, recordCustomerChange } from './changes'
import { encryptCustomerPhone, phoneBlindIndex } from './phone-crypto'

export type NewCustomerInput = {
  name?: string | null | undefined
  email?: string | null | undefined
  phone?: string | null | undefined
  note?: string | null | undefined
  tags?: readonly string[] | undefined
  /** Channels the customer agreed to (told staff in person, on a call, on a signed form). */
  consent?: Partial<Record<ConsentChannel, boolean | undefined>> | undefined
  /** A first address for their book (`AddressInputSchema`); it becomes the default. */
  address?: unknown
}

export type CreateCustomerResult =
  | { ok: true; id: string }
  /** `existingId`: the customer who already has this email or mobile. */
  | { ok: false; reason: 'duplicate'; field: 'email' | 'phone'; existingId: string }
  | { ok: false; reason: 'invalid'; errors: Record<string, string> }

const MAX_TAGS = 50

const EmailSchema = z.email('Enter a valid email address')

/** Trimmed, case-insensitively unique tags, at most 50, each at most 40 characters. */
function cleanTags(tags: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.trim().slice(0, 40)
    if (!tag || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    out.push(tag)
  }
  return out.slice(0, MAX_TAGS)
}

/**
 * The customer who already has this ten digit mobile. Checkout stores the number as typed, so
 * both the bare and the 91-prefixed forms are looked up: by blind index on encrypted rows, by
 * the plain value on rows the phone backfill has not reached.
 */
export async function customerWithPhone(
  ctx: StoreContext,
  mobile: string,
  secret: string,
  /** Leave this customer out (the one about to take the number). */
  exceptId?: string,
): Promise<string | null> {
  const forms = [mobile, `91${mobile}`]
  const [row] = await ctx.tx
    .select({ id: customer.id })
    .from(customer)
    .where(
      and(
        exceptId ? ne(customer.id, exceptId) : undefined,
        or(
          inArray(
            customer.phoneIndex,
            forms.map((f) => phoneBlindIndex(f, secret)),
          ),
          and(
            isNull(customer.phoneIndex),
            inArray(customer.phone, [...forms, `+91${mobile}`, `+91 ${mobile}`]),
          ),
        ),
      ),
    )
    .limit(1)
  return row?.id ?? null
}

/** The customer who already has this email (any case), leaving out `exceptId`. */
export async function customerWithEmail(
  ctx: StoreContext,
  email: string,
  exceptId?: string,
): Promise<string | null> {
  const [row] = await ctx.tx
    .select({ id: customer.id })
    .from(customer)
    .where(
      and(
        exceptId ? ne(customer.id, exceptId) : undefined,
        sql`lower(${customer.email}) = ${email.trim().toLowerCase()}`,
      ),
    )
    .limit(1)
  return row?.id ?? null
}

/**
 * Create a customer from the admin. Needs an email or a mobile number; refuses one another
 * customer of the store already has (`duplicate`, with who), so a shopper is never split in
 * two. Everything is checked before anything is written. Consent goes through the consent
 * writer with the staff member as the actor, so it is in the customer's history.
 */
export async function createCustomer(
  ctx: StoreContext,
  input: NewCustomerInput,
  meta: { secret: string; actor: PrivacyActor },
): Promise<CreateCustomerResult> {
  const errors: Record<string, string> = {}
  const name = input.name?.trim() || null
  const rawEmail = input.email?.trim().toLowerCase() || null
  const rawPhone = input.phone?.trim() || null
  let email: string | null = null
  if (rawEmail) {
    const parsed = EmailSchema.safeParse(rawEmail)
    if (parsed.success) email = parsed.data
    else errors.email = 'Enter a valid email address'
  }
  const mobile = rawPhone ? normaliseMobile(rawPhone) : null
  if (rawPhone && !mobile) errors.phone = 'Enter a ten digit mobile number'
  if (!rawEmail && !rawPhone) errors.email = 'Add an email or a mobile number'
  if (name && name.length > 200) errors.name = 'Too long'
  const note = input.note?.trim() || null
  if (note && note.length > 2000) errors.note = 'Too long'

  let address: z.output<typeof AddressInputSchema> | null = null
  if (input.address !== undefined && input.address !== null) {
    const parsed = AddressInputSchema.safeParse(input.address)
    if (parsed.success) address = parsed.data
    else Object.assign(errors, fieldErrors(parsed.error))
  }
  if (Object.keys(errors).length > 0) return { ok: false, reason: 'invalid', errors }

  if (email) {
    const existingId = await customerWithEmail(ctx, email)
    if (existingId) return { ok: false, reason: 'duplicate', field: 'email', existingId }
  }
  if (mobile) {
    const existingId = await customerWithPhone(ctx, mobile, meta.secret)
    if (existingId) return { ok: false, reason: 'duplicate', field: 'phone', existingId }
  }

  const tags = cleanTags(input.tags ?? [])
  const phone = mobile ? encryptCustomerPhone(mobile, meta.secret) : null
  const [row] = await ctx.tx
    .insert(customer)
    .values({
      storeId: ctx.storeId,
      email,
      phone: phone?.cipher ?? null,
      phoneIndex: phone?.index ?? null,
      name,
      note,
      tags,
    })
    .returning({ id: customer.id })
  const id = row?.id as string

  // The raw form goes in: the parsed one has nulls the schema would refuse a second time.
  if (address) await createAddress(ctx, id, { ...(input.address as object), isDefault: true })
  for (const channel of CONSENT_CHANNELS) {
    if (input.consent?.[channel] !== true) continue
    await setMarketingConsent(ctx, {
      customerId: id,
      channel,
      granted: true,
      source: 'admin',
      actor: meta.actor,
    })
  }
  await recordCustomerChange(ctx.tx, ctx.storeId, id, 'created')
  await noteCustomerTagsChanged(ctx.tx, ctx.storeId, id, [], tags)
  return { ok: true, id }
}
