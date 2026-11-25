/** SOURCE OF TRUTH: Inbox chat email sweep tests — WHAT: a missed reply and a closed chat email the shopper, an unanswered chat emails the team, each only once, and an assigned chat only its assignee / WHY: overlapping sweeps or a busy chat must never flood anyone's inbox */
import {
  authSchema,
  createDb,
  inboxConversation,
  inboxMessage,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { builtInNotificationRegistry } from '../notifications/settings'
import { listRoles, seedSystemRoles, upsertMember } from '../permissions/service'
import { sendInboxChatEmails } from './chat-emails'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const registry = builtInNotificationRegistry()
const NOW = new Date('2026-11-22T10:00:00Z')
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

function recorder(): NotificationChannel & { sent: Message[] } {
  return {
    id: 'email',
    label: 'email',
    requires: 'email',
    sent: [],
    async send(m) {
      this.sent.push(m)
      return { ok: true, providerRef: `e_${this.sent.length}` }
    },
  }
}

/** A store with Inbox installed and its owner (Inbox email alerts on by default). */
async function seed() {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'w', name: 'Waimers', apps: { installed: ['inbox'], settings: {} } })
    .returning()
  const storeId = s?.id as string
  await owner.insert(authSchema.user).values([
    { id: 'u-owner', name: 'Owner', email: 'owner@example.com' },
    { id: 'u-staff', name: 'Staff', email: 'staff@example.com' },
  ])
  await withStore(owner, storeId, async (tx) => {
    await seedSystemRoles(tx, storeId)
    const roles = await listRoles(tx, storeId)
    const roleOf = (slug: string) => roles.find((r) => r.slug === slug)?.id as string
    await upsertMember(tx, { storeId, userId: 'u-owner', roleId: roleOf('owner') })
    await upsertMember(tx, { storeId, userId: 'u-staff', roleId: roleOf('staff') })
  })
  return storeId
}

type Line = { sender: 'shopper' | 'staff'; body: string; at: Date; kind?: 'text' | 'note' }

async function chat(
  storeId: string,
  lines: Line[],
  over: Partial<typeof inboxConversation.$inferInsert> = {},
) {
  const last = lines.at(-1) as Line
  const [c] = await owner
    .insert(inboxConversation)
    .values({
      storeId,
      contactName: 'Asha',
      contactEmail: 'asha@example.com',
      lastMessageAt: last.at,
      lastSender: last.sender,
      unreadShopper: last.sender === 'staff' ? 1 : 0,
      unreadStaff: last.sender === 'shopper' ? 1 : 0,
      firstResponseAt: lines.find((l) => l.sender === 'staff')?.at ?? null,
      createdAt: lines[0]?.at,
      ...over,
    })
    .returning()
  for (const l of lines) {
    await owner.insert(inboxMessage).values({
      storeId,
      conversationId: c?.id as string,
      sender: l.sender,
      kind: l.kind ?? 'text',
      body: l.body,
      createdAt: l.at,
    })
  }
  return c?.id as string
}

const sweep = (storeId: string, channel: NotificationChannel, now = NOW) =>
  withStore(app, storeId, (tx) =>
    sendInboxChatEmails(
      { storeId, tx },
      {
        registry,
        settingsSecret: 'test-settings-secret-test-settings-secret',
        channels: [channel],
        storefrontUrl: 'https://shop.example',
        adminUrl: 'https://admin.example/',
        now,
      },
    ),
  )

describe('sendInboxChatEmails', () => {
  it('emails the shopper a reply they missed, once, without team notes', async () => {
    const storeId = await seed()
    await chat(storeId, [
      { sender: 'shopper', body: 'Is XL in stock?', at: ago(20) },
      { sender: 'staff', body: 'Internal: check godown', at: ago(19), kind: 'note' },
      { sender: 'staff', body: 'Yes, ships today', at: ago(8) },
    ])
    const email = recorder()
    expect(await sweep(storeId, email)).toEqual({ replies: 1, transcripts: 0, staff: 0 })
    const [m] = email.sent
    expect(m).toMatchObject({ template: 'chat_reply', to: { email: 'asha@example.com' } })
    expect(m?.data.actionUrl).toBe('https://shop.example/?chat=open')
    expect(m?.data.chat?.messages.map((x) => [x.from, x.text])).toEqual([
      ['shopper', 'Is XL in stock?'],
      ['store', 'Yes, ships today'],
    ])
    // The next sweep, and one an hour later with nothing new, send nothing.
    expect(await sweep(storeId, email)).toEqual({ replies: 0, transcripts: 0, staff: 0 })
    expect((await sweep(storeId, email, new Date(NOW.getTime() + 3_600_000))).replies).toBe(0)
    expect(email.sent).toHaveLength(1)
  })

  it('sends nothing while the reply is fresh or seen, or with no email to send to', async () => {
    const storeId = await seed()
    await chat(storeId, [{ sender: 'staff', body: 'Hello', at: ago(2) }])
    await chat(storeId, [{ sender: 'staff', body: 'Seen', at: ago(9) }], { unreadShopper: 0 })
    await chat(storeId, [{ sender: 'staff', body: 'No email', at: ago(9) }], {
      contactEmail: null,
    })
    const email = recorder()
    await sweep(storeId, email)
    expect(email.sent).toHaveLength(0)
  })

  it('emails the closed chat as a transcript', async () => {
    const storeId = await seed()
    await chat(
      storeId,
      [
        { sender: 'shopper', body: 'Hi', at: ago(30) },
        { sender: 'staff', body: 'Hello Asha', at: ago(29) },
      ],
      { status: 'closed', closedAt: ago(5), unreadShopper: 0 },
    )
    const email = recorder()
    expect((await sweep(storeId, email)).transcripts).toBe(1)
    expect(email.sent[0]?.template).toBe('chat_transcript')
    expect(email.sent[0]?.data.chat?.messages).toHaveLength(2)
    await sweep(storeId, email)
    expect(email.sent).toHaveLength(1)
  })

  it('tells the owner about an unanswered chat once; an assigned chat goes only to its assignee', async () => {
    const storeId = await seed()
    await chat(storeId, [{ sender: 'shopper', body: 'Anyone there?', at: ago(7) }])
    await chat(storeId, [{ sender: 'shopper', body: 'For staff', at: ago(7) }], {
      contactName: 'Ravi',
      assigneeUserId: 'u-staff',
    })
    const email = recorder()
    expect((await sweep(storeId, email)).staff).toBe(1)
    expect(email.sent).toHaveLength(1)
    const [m] = email.sent
    expect(m).toMatchObject({ template: 'staff_chat_waiting', to: { email: 'owner@example.com' } })
    expect(m?.data.chatWaiting?.threads.map((t) => t.name)).toEqual(['Asha'])
    expect(m?.data.chatWaiting?.threads[0]?.url).toMatch(
      /^https:\/\/admin\.example\/sales-channels\/inbox\/conversations\?id=/,
    )
    expect(m?.data.chatWaiting?.threads[0]?.waitingLabel).toBe('Waiting 7 min')
    expect((await sweep(storeId, email)).staff).toBe(0)
  })

  it('still finds a fresh missed reply on a day with more chats than one sweep scans', async () => {
    const storeId = await seed()
    // 200 quiet chats from earlier today (the shopper's last line, already read by staff).
    await owner.insert(inboxConversation).values(
      Array.from({ length: 200 }, (_, i) => ({
        storeId,
        contactEmail: `old${i}@example.com`,
        lastMessageAt: ago(600 + i),
        lastSender: 'shopper' as const,
        createdAt: ago(600 + i),
      })),
    )
    await chat(storeId, [{ sender: 'staff', body: 'Yes, ships today', at: ago(8) }])
    const email = recorder()
    expect((await sweep(storeId, email)).replies).toBe(1)
    expect(email.sent[0]?.to.email).toBe('asha@example.com')
  })

  it('does nothing when Inbox is not installed', async () => {
    const storeId = await seed()
    await owner.update(store).set({ apps: { installed: [], settings: {} } })
    await chat(storeId, [{ sender: 'staff', body: 'Hello', at: ago(9) }])
    const email = recorder()
    expect(await sweep(storeId, email)).toEqual({ replies: 0, transcripts: 0, staff: 0 })
  })
})
