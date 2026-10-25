import { insertOutboxEvent } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { desc, eq } from 'drizzle-orm'
import { contactMessage } from './schema'

export type ContactInput = {
  name: string
  email: string
  phone: string
  body: string
  /** Every other `contact[...]` field, label to value. */
  fields: Record<string, string>
  path: string
}

export type ParsedContact = { ok: true; value: ContactInput } | { ok: false; error: string }

const MAX = { name: 200, email: 254, phone: 40, body: 5000, field: 1000, key: 60, fields: 30 }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const clip = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

/**
 * Reads a theme form's post (Shopify's `contact[...]` names) into a message. A message
 * needs a valid email or phone to be answered, and something said: the body or any other
 * field. Every limit is a cap, never trust the browser's.
 */
export function parseContactForm(form: { entries(): Iterable<[string, unknown]> }): ParsedContact {
  const out: ContactInput = { name: '', email: '', phone: '', body: '', fields: {}, path: '' }
  for (const [rawKey, value] of form.entries()) {
    const key = /^contact\[(.{1,80})\]$/.exec(rawKey)?.[1]
    if (!key) continue
    const lower = key.toLowerCase()
    if (lower === 'email') out.email = clip(value, MAX.email)
    else if (lower === 'name') out.name = clip(value, MAX.name)
    else if (lower === 'phone') out.phone = clip(value, MAX.phone)
    else if (lower === 'body') out.body = clip(value, MAX.body)
    else if (Object.keys(out.fields).length < MAX.fields) {
      const text = clip(value, MAX.field)
      if (text) out.fields[key.slice(0, MAX.key)] = text
    }
  }
  if (!out.email && !out.phone) return { ok: false, error: 'email' }
  if (out.email && !EMAIL.test(out.email)) return { ok: false, error: 'email' }
  if (!out.body && Object.keys(out.fields).length === 0) return { ok: false, error: 'body' }
  return { ok: true, value: out }
}

/** The text of a message for the store's email: the body, then each other field. */
export function messageText(row: Pick<ContactRow, 'body' | 'fields'>): string {
  const extra = Object.entries(parseFields(row.fields)).map(([k, v]) => `${k}: ${v}`)
  return [row.body, ...extra].filter(Boolean).join('\n')
}

export type ContactRow = typeof contactMessage.$inferSelect

function parseFields(json: string): Record<string, string> {
  try {
    const v: unknown = JSON.parse(json)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    return Object.fromEntries(
      Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string'),
    )
  } catch {
    return {}
  }
}

/** Saves a message for the store and queues the email to its contact address (outbox, same transaction). */
export async function saveContactMessage(
  tx: StoreTx,
  storeId: string,
  input: ContactInput,
): Promise<string> {
  const [row] = await tx
    .insert(contactMessage)
    .values({
      storeId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      body: input.body,
      fields: JSON.stringify(input.fields),
      path: input.path.slice(0, 200),
    })
    .returning({ id: contactMessage.id })
  if (!row) throw new Error('contact message not saved')
  await insertOutboxEvent(tx, storeId, 'contact.message_received', { contactMessageId: row.id })
  return row.id
}

/** Newest first; the admin list shows the latest 200. */
export function listContactMessages(tx: StoreTx, limit = 200): Promise<ContactRow[]> {
  return tx.select().from(contactMessage).orderBy(desc(contactMessage.createdAt)).limit(limit)
}

export async function getContactMessage(tx: StoreTx, id: string): Promise<ContactRow | null> {
  const [row] = await tx.select().from(contactMessage).where(eq(contactMessage.id, id))
  return row ?? null
}
