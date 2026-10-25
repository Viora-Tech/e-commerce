import { createDb, outboxEvent, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  listContactMessages,
  messageText,
  parseContactForm,
  saveContactMessage,
} from '../src/messages'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const form = (fields: Record<string, string>) => new FormData_(fields)

/** The slice of FormData the parser reads. */
class FormData_ {
  constructor(private fields: Record<string, string>) {}
  entries() {
    return Object.entries(this.fields)
  }
}

async function seedStore() {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

describe('parseContactForm', () => {
  it('reads Shopify contact[...] fields and keeps the extra ones', () => {
    const r = parseContactForm(
      form({
        'contact[name]': ' Asha ',
        'contact[email]': 'asha@example.com',
        'contact[body]': 'Which shade?',
        'contact[Skin type]': 'Dry',
        form_type: 'contact',
        utf8: '✓',
      }),
    )
    expect(r).toEqual({
      ok: true,
      value: {
        name: 'Asha',
        email: 'asha@example.com',
        phone: '',
        body: 'Which shade?',
        fields: { 'Skin type': 'Dry' },
        path: '',
      },
    })
  })

  it('needs a valid email or a phone, and something said', () => {
    expect(parseContactForm(form({ 'contact[body]': 'hi' }))).toEqual({ ok: false, error: 'email' })
    expect(parseContactForm(form({ 'contact[email]': 'nope', 'contact[body]': 'hi' })).ok).toBe(
      false,
    )
    expect(parseContactForm(form({ 'contact[email]': 'a@b.co' }))).toEqual({
      ok: false,
      error: 'body',
    })
    expect(
      parseContactForm(form({ 'contact[phone]': '9876543210', 'contact[body]': 'hi' })).ok,
    ).toBe(true)
  })

  it('caps long values', () => {
    const r = parseContactForm(
      form({ 'contact[email]': 'a@b.co', 'contact[body]': 'x'.repeat(9000) }),
    )
    expect(r.ok && r.value.body.length).toBe(5000)
  })
})

describe('saveContactMessage', () => {
  it('saves under the store, queues the email, and stays invisible to another store', async () => {
    const a = await seedStore()
    const b = await seedStore()
    const input = {
      name: 'Asha',
      email: 'asha@example.com',
      phone: '',
      body: 'Hello',
      fields: { Order: '1042' },
      path: '/pages/contact',
    }
    const id = await withStore(app, a, (tx) => saveContactMessage(tx, a, input))
    const mine = await withStore(app, a, (tx) => listContactMessages(tx))
    expect(mine.map((m) => m.id)).toEqual([id])
    expect(messageText(mine[0] as (typeof mine)[number])).toBe('Hello\nOrder: 1042')
    expect(await withStore(app, b, (tx) => listContactMessages(tx))).toEqual([])
    const events = await owner.select().from(outboxEvent)
    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('contact.message_received')
    expect(events[0]?.payload).toEqual({ contactMessageId: id })
  })

  it('refuses to save into another store', async () => {
    const a = await seedStore()
    const b = await seedStore()
    await expect(
      withStore(app, a, (tx) =>
        saveContactMessage(tx, b, {
          name: '',
          email: 'x@y.co',
          phone: '',
          body: 'hi',
          fields: {},
          path: '',
        }),
      ),
    ).rejects.toThrow()
  })
})
