import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { customer, newId, store } from './schema'

/*
 * Shopper login options (migration 0076): social and Truecaller identities linked to a
 * customer, passkeys, and short-lived login tickets (the single-use hand-off from the
 * platform login domain back to the store's domain, pending Truecaller requests and
 * emailed magic links).
 * Every table carries `store_id` and sits under RLS: a Google account that shops at two
 * stores is two identities, one per store, each linked to that store's customer row.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const SHOPPER_IDENTITY_PROVIDERS = ['google', 'apple', 'facebook', 'truecaller'] as const

/**
 * A provider account (Google `sub`, Apple `sub`, Facebook id, Truecaller phone) that signs
 * in as a customer. `subject` is the provider's stable id, never the email.
 */
export const customerIdentity = pgTable(
  'customer_identity',
  {
    id: id(),
    storeId: storeId(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id),
    provider: text('provider', { enum: SHOPPER_IDENTITY_PROVIDERS }).notNull(),
    subject: text('subject').notNull(),
    /** The email the provider reported when linked, for the shopper's own account page. */
    email: text('email'),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('customer_identity_store_provider_subject').on(t.storeId, t.provider, t.subject),
    index('customer_identity_customer').on(t.customerId),
    check(
      'customer_identity_provider_check',
      sql`${t.provider} in ('google', 'apple', 'facebook', 'truecaller')`,
    ),
  ],
)

/**
 * A WebAuthn credential. `rpId` is the store hostname it was registered on: a passkey
 * only works on that exact domain, so the sign-in page offers it there only.
 */
export const customerPasskey = pgTable(
  'customer_passkey',
  {
    id: id(),
    storeId: storeId(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id),
    /** base64url credential id from the authenticator. */
    credentialId: text('credential_id').notNull(),
    /** base64url COSE public key. */
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    transports: text('transports').array().notNull().default([]),
    rpId: text('rp_id').notNull(),
    /** `singleDevice` or `multiDevice` (synced passkey). */
    deviceType: text('device_type').notNull(),
    backedUp: boolean('backed_up').notNull().default(false),
    /** What the shopper sees in their list, e.g. "iPhone" from the browser. */
    name: text('name'),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('customer_passkey_store_credential').on(t.storeId, t.credentialId),
    index('customer_passkey_customer').on(t.customerId),
  ],
)

const LOGIN_TICKET_KINDS = [
  'handoff',
  'truecaller',
  'magic_link',
  'passkey_register',
  'passkey_login',
] as const
const LOGIN_TICKET_STATUSES = [
  'pending',
  'ready',
  'verify_email',
  'verify_phone',
  'phone_code_sent',
  'failed',
] as const

/**
 * A login in flight. `handoff`: minted on the platform login domain after a provider
 * sign-in, redeemed once on the store's domain. `truecaller`: created when the shopper
 * taps the button, filled in by Truecaller's server callback, redeemed once by the
 * browser that started it; when the number belongs to an existing customer who never
 * used Truecaller here, it waits on a phone code first (`verify_phone`, then
 * `phone_code_sent`; security audit D-03). `magic_link`: a sign-in link emailed to
 * `email`, spent on first use. `passkey_register` / `passkey_login`: the WebAuthn
 * `challenge` for the browser whose cookie hashes to `token_hash` (and `customer_id` when
 * registering), on the rpID kept in `return_url`; spent on first use (D-04). Only the
 * token's hash is stored; rows live minutes.
 */
export const customerLoginTicket = pgTable(
  'customer_login_ticket',
  {
    id: id(),
    storeId: storeId(),
    kind: text('kind', { enum: LOGIN_TICKET_KINDS }).notNull(),
    tokenHash: text('token_hash').notNull(),
    status: text('status', { enum: LOGIN_TICKET_STATUSES }).notNull().default('pending'),
    customerId: uuid('customer_id').references(() => customer.id),
    /** The exact store URL the hand-off must come back to. */
    returnUrl: text('return_url'),
    /** sha256 of the random value in the starting browser's cookie. */
    browserHash: text('browser_hash'),
    /** Same-site path to land on after signing in. */
    nextPath: text('next_path'),
    remember: boolean('remember').notNull().default(false),
    /** A pending provider identity (`verify_email`), or who a magic link is for (`email`). */
    provider: text('provider', { enum: SHOPPER_IDENTITY_PROVIDERS }),
    subject: text('subject'),
    email: text('email'),
    name: text('name'),
    /** The WebAuthn challenge a passkey ticket waits for. */
    challenge: text('challenge'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('customer_login_ticket_token').on(t.tokenHash),
    index('customer_login_ticket_expires').on(t.storeId, t.expiresAt),
    check(
      'customer_login_ticket_kind_check',
      sql`${t.kind} in ('handoff', 'truecaller', 'magic_link', 'passkey_register', 'passkey_login')`,
    ),
    check(
      'customer_login_ticket_status_check',
      sql`${t.status} in ('pending', 'ready', 'verify_email', 'verify_phone', 'phone_code_sent', 'failed')`,
    ),
  ],
)
