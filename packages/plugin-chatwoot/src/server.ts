import {
  appSettingsOf,
  decryptCustomerPhone,
  decryptSecret,
  parseAppsSettings,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { customer, order, store } from '@commerce/db'
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import {
  type ChatwootClient,
  type ChatwootClientOptions,
  type ChatwootContact,
  type ChatwootConversation,
  ChatwootError,
  chatwootClient,
} from './client'
import { type CustomerFacts, contactInput, contactNeedsUpdate, pickContact } from './contact'
import {
  CHATWOOT_ID,
  type ChatwootSettings,
  chatwootApiReady,
  chatwootLinks,
  normaliseChatwootUrl,
  parseChatwootSettings,
} from './settings'

/**
 * The Chatwoot app's server side: reading its settings and a customer's facts from the store's
 * tables, the contact sync the worker runs, and the conversation lookup behind the admin cards.
 * Database reads take a transaction; Chatwoot calls never run inside one (the app role's
 * idle-in-transaction timeout), so callers read first and call Chatwoot after.
 */

/** The app's entry in `store.apps`, and whether the store installed it. */
export async function loadChatwootSettings(
  tx: StoreTx,
  storeId: string,
): Promise<{ installed: boolean; settings: ChatwootSettings }> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  return chatwootSettingsFromApps(s?.apps)
}

export function chatwootSettingsFromApps(apps: unknown): {
  installed: boolean
  settings: ChatwootSettings
} {
  const parsed = parseAppsSettings(apps)
  return {
    installed: parsed.installed.includes(CHATWOOT_ID),
    settings: parseChatwootSettings(appSettingsOf(parsed, CHATWOOT_ID)),
  }
}

/** A saved secret, decrypted; null when none is saved or it no longer decrypts. */
export function readSecret(blob: string, secret: string): string | null {
  if (!blob) return null
  try {
    return decryptSecret(blob, secret)
  } catch {
    return null
  }
}

/**
 * An API client for the saved settings, or null while the address, account id or token is
 * missing (or the token no longer decrypts).
 */
export function chatwootApi(
  settings: ChatwootSettings,
  secret: string,
  opts: Pick<ChatwootClientOptions, 'trustedOrigins' | 'fetch' | 'lookup'> = {},
): { client: ChatwootClient; links: ReturnType<typeof chatwootLinks> } | null {
  const baseUrl = normaliseChatwootUrl(settings.baseUrl)
  const apiToken = readSecret(settings.apiToken, secret)
  if (!baseUrl || !apiToken || !chatwootApiReady(settings)) return null
  return {
    client: chatwootClient({ ...opts, baseUrl, accountId: settings.accountId, apiToken }),
    links: chatwootLinks(baseUrl, settings.accountId),
  }
}

/** A customer's profile and order totals; null for a missing or erased customer. */
export async function loadCustomerFacts(
  tx: StoreTx,
  customerId: string,
  secret: string,
): Promise<CustomerFacts | null> {
  const [row] = await tx
    .select({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      createdAt: customer.createdAt,
      anonymisedAt: customer.anonymisedAt,
    })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!row || row.anonymisedAt) return null
  const [totals] = await tx
    .select({
      orderCount: sql<number>`count(*)::int`,
      spentPaise: sql<number>`coalesce(sum(${order.totalPaise}) filter (where ${order.status} <> 'cancelled'), 0)::bigint`,
    })
    .from(order)
    .where(and(eq(order.customerId, customerId), ne(order.status, 'draft')))
  const [last] = await tx
    .select({ number: order.number, placedAt: order.placedAt })
    .from(order)
    .where(and(eq(order.customerId, customerId), ne(order.status, 'draft')))
    .orderBy(desc(order.placedAt))
    .limit(1)
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: decryptCustomerPhone(row.phone, secret),
    createdAt: row.createdAt,
    orderCount: Number(totals?.orderCount ?? 0),
    spentPaise: Number(totals?.spentPaise ?? 0),
    lastOrderNumber: last?.number ?? null,
    lastOrderAt: last?.placedAt ?? null,
  }
}

/** Who to look for in Chatwoot for an order: its customer, else the email it was placed with. */
export async function orderContactOf(
  tx: StoreTx,
  orderId: string,
  secret: string,
): Promise<{ id: string; email: string | null; phone: string | null } | null> {
  const [o] = await tx
    .select({ customerId: order.customerId, email: order.email })
    .from(order)
    .where(eq(order.id, orderId))
  if (!o) return null
  if (o.customerId) {
    const facts = await loadCustomerFacts(tx, o.customerId, secret)
    if (facts) return { id: facts.id, email: facts.email, phone: facts.phone }
  }
  return o.email ? { id: '', email: o.email, phone: null } : null
}

type Who = { id: string; email: string | null; phone: string | null }

/**
 * The Chatwoot contact that is this customer: searched by our identifier, then by email, then
 * by phone. At most three searches, and one when the contact was synced before.
 */
export async function findChatwootContact(
  client: ChatwootClient,
  who: Who,
): Promise<ChatwootContact | null> {
  const queries = [who.id, who.email, who.phone?.replace(/[\s-]/g, '')].filter(
    (q): q is string => typeof q === 'string' && q.length > 0,
  )
  for (const q of [...new Set(queries)]) {
    const found = pickContact(await client.searchContacts(q), who)
    if (found) return found
  }
  return null
}

export type ContactSync = { action: 'created' | 'updated' | 'unchanged'; contactId: number }

/** Retry a write Chatwoot refused (an email or phone another contact holds) without those two. */
async function withoutClashes<T>(
  write: (input: ReturnType<typeof contactInput>) => Promise<T>,
  input: ReturnType<typeof contactInput>,
): Promise<T> {
  try {
    return await write(input)
  } catch (err) {
    if (!(err instanceof ChatwootError) || err.code !== 'invalid') throw err
    const { email: _email, phone_number: _phone, ...rest } = input
    return write(rest)
  }
}

/**
 * Create or update the customer's Chatwoot contact. Idempotent: an up-to-date contact is not
 * written again, so repeats and retries cost one search. Throws `ChatwootError` (the worker
 * retries with backoff, which also waits out Chatwoot's rate limit).
 */
export async function syncChatwootContact(
  client: ChatwootClient,
  facts: CustomerFacts,
): Promise<ContactSync> {
  const input = contactInput(facts)
  const existing = await findChatwootContact(client, facts)
  if (!existing) {
    const created = await withoutClashes((body) => client.createContact(body), input)
    return { action: 'created', contactId: created.id }
  }
  if (!contactNeedsUpdate(existing, input)) return { action: 'unchanged', contactId: existing.id }
  await withoutClashes((body) => client.updateContact(existing.id, body), input)
  return { action: 'updated', contactId: existing.id }
}

/** What the Conversations card on a customer or order page draws. */
export type ChatwootConversationsView =
  | { state: 'not-installed' }
  | { state: 'not-connected' }
  | { state: 'error'; message: string }
  | { state: 'no-contact'; dashboardUrl: string }
  | {
      state: 'ready'
      contactUrl: string
      conversations: (ChatwootConversation & { url: string })[]
    }

/** The contact's conversations with dashboard links, or a state the card can draw. */
export async function chatwootConversationsFor(
  api: NonNullable<ReturnType<typeof chatwootApi>>,
  who: Who,
  limit = 10,
): Promise<ChatwootConversationsView> {
  try {
    const contact = await findChatwootContact(api.client, who)
    if (!contact) return { state: 'no-contact', dashboardUrl: api.links.dashboard }
    const conversations = await api.client.contactConversations(contact.id)
    return {
      state: 'ready',
      contactUrl: api.links.contact(contact.id),
      conversations: conversations
        .slice(0, limit)
        .map((c) => ({ ...c, url: api.links.conversation(c.id) })),
    }
  } catch (err) {
    if (err instanceof ChatwootError) return { state: 'error', message: err.message }
    throw err
  }
}
