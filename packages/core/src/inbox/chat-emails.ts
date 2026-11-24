/** SOURCE OF TRUTH: sendInboxChatEmails — WHAT: one sweep of a store's Inbox chats that emails the shopper a reply they missed or the closed chat's transcript, and emails each team member with Inbox alerts on the chats nobody answered / WHY: chats happen while people are away; each chat is claimed before it is sent (its timestamp moved in the same statement that checks it), so overlapping sweeps never send twice, and the timing rules in `chat-email-rules.ts` keep it to one email per chat per window. */
import { formatInZone } from '@commerce/dates'
import { customer, inboxConversation, inboxMessage, notification, type StoreTx } from '@commerce/db'
import type { ChatEmailMessage, ChatWaitingThread, TemplateData } from '@commerce/notifications'
import { and, count, desc, eq, gt, isNull, ne, notInArray, or, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { storefrontOriginFor } from '../domains/origin'
import { alertMembers, deliverToMember } from '../member-account/alerts'
import {
  channelsFor,
  type DeliverOptions,
  type DeliveryResult,
  messageOn,
} from '../notifications/deliver'
import { permissions } from '../permissions/statement'
import {
  CHAT_EMAIL_TIMING,
  chatEmailLine,
  shopperReplyDue,
  staffAlertDue,
  transcriptDue,
  waitingLabel,
} from './chat-email-rules'
import { inboxState } from './state'

/** A reply email shows this much of the chat; a transcript, the whole of a normal chat. */
const REPLY_LINES = 10
const TRANSCRIPT_LINES = 60
/** The team email shows each chat's last shopper lines and at most this many chats. */
const WAITING_LINES = 3
const WAITING_THREADS = 10
/** Chats one sweep looks at per store. */
const SCAN_LIMIT = 200

export type ChatEmailOptions = DeliverOptions & {
  /** Platform storefront URL, the fallback when the store has no live domain. */
  storefrontUrl: string
  /** The admin's own URL (`ADMIN_URL`), for the team email's links. */
  adminUrl: string
  now?: Date | undefined
}

export type ChatEmailCounts = { replies: number; transcripts: number; staff: number }

type Conversation = typeof inboxConversation.$inferSelect

const conversationPath = (id: string) =>
  `/sales-channels/inbox/conversations?id=${encodeURIComponent(id)}`

/** The chat's lines, oldest first, with how many older ones were left out. */
async function chatLines(
  tx: StoreTx,
  c: Conversation,
  limit: number,
  names: { shopper: string; store: string },
  timeZone: string,
): Promise<{ messages: ChatEmailMessage[]; at: Date[]; earlier: number }> {
  const visible = and(
    eq(inboxMessage.conversationId, c.id),
    ne(inboxMessage.sender, 'system'),
    notInArray(inboxMessage.kind, ['note', 'system', 'cart_event']),
  )
  const rows = await tx
    .select({
      sender: inboxMessage.sender,
      kind: inboxMessage.kind,
      body: inboxMessage.body,
      payload: inboxMessage.payload,
      createdAt: inboxMessage.createdAt,
    })
    .from(inboxMessage)
    .where(visible)
    .orderBy(desc(inboxMessage.id))
    .limit(limit)
  const time = (at: Date) =>
    formatInZone(
      at,
      { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' },
      { timeZone, locale: 'en-IN' },
    )
  const messages: ChatEmailMessage[] = []
  const at: Date[] = []
  for (const m of rows.reverse()) {
    const line = chatEmailLine(m, names, time)
    if (!line) continue
    messages.push(line)
    at.push(m.createdAt)
  }
  let earlier = 0
  if (rows.length === limit) {
    const [n] = await tx.select({ n: count() }).from(inboxMessage).where(visible)
    earlier = Math.max(0, (n?.n ?? 0) - rows.length)
  }
  return { messages, at, earlier }
}

/** Where the shopper's email goes: their account's address, else the one they typed. */
async function shopperAddress(tx: StoreTx, c: Conversation): Promise<string | null> {
  if (c.customerId) {
    const [cu] = await tx
      .select({ email: customer.email })
      .from(customer)
      .where(eq(customer.id, c.customerId))
    if (cu?.email) return cu.email
  }
  return c.contactEmail?.trim() || null
}

/** Takes the chat for this sweep: moves `column` to now unless another sweep just did. */
async function claim(
  tx: StoreTx,
  c: Conversation,
  column: 'shopperEmailedAt' | 'unansweredAlertedAt',
  now: Date,
): Promise<boolean> {
  const col = inboxConversation[column]
  const before = c[column]
  const rows = await tx
    .update(inboxConversation)
    .set({ [column]: now })
    .where(and(eq(inboxConversation.id, c.id), before ? eq(col, before) : isNull(col)))
    .returning({ id: inboxConversation.id })
  return rows.length > 0
}

/** One shopper email on the store's email channels, logged like every notification. */
async function sendToShopper(
  ctx: StoreContext,
  template: 'chat_reply' | 'chat_transcript',
  to: string,
  data: TemplateData,
  opts: DeliverOptions,
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = []
  for (const channel of await channelsFor(ctx, opts)) {
    if (channel.requires !== 'email') continue
    const r = await channel.send({ to: { email: to }, template, data })
    await ctx.tx.insert(notification).values({
      storeId: ctx.storeId,
      channel: channel.id,
      template,
      to,
      status: r.ok ? 'sent' : 'failed',
      providerRef: r.ok ? r.providerRef : null,
      error: r.ok ? null : r.error,
    })
    results.push({ channel: channel.id, to, ok: r.ok, error: r.ok ? undefined : r.error })
  }
  return results
}

const plainData = (storeName: string): TemplateData => ({
  storeName,
  customerName: '',
  totalLabel: '',
  lines: [],
  paymentMethodLabel: '',
})

/**
 * Emails due in one store: shoppers who missed a reply or whose chat closed, then one email per
 * team member listing the chats waiting for them. Nothing when Inbox is not installed.
 */
export async function sendInboxChatEmails(
  ctx: StoreContext,
  opts: ChatEmailOptions,
): Promise<ChatEmailCounts> {
  const now = opts.now ?? new Date()
  const counts: ChatEmailCounts = { replies: 0, transcripts: 0, staff: 0 }
  const state = await inboxState(ctx.tx, ctx.storeId)
  if (!state.installed) return counts

  const since = new Date(now.getTime() - CHAT_EMAIL_TIMING.maxAgeMs)
  const candidates = await ctx.tx
    .select()
    .from(inboxConversation)
    .where(
      and(
        isNull(inboxConversation.anonymisedAt),
        or(gt(inboxConversation.lastMessageAt, since), gt(inboxConversation.closedAt, since)),
      ),
    )
    // Newest first: what is due now is the latest activity, so a busy day's older chats never
    // crowd it out of the scan.
    .orderBy(
      desc(
        sql`greatest(${inboxConversation.lastMessageAt}, coalesce(${inboxConversation.closedAt}, ${inboxConversation.lastMessageAt}))`,
      ),
    )
    .limit(SCAN_LIMIT)

  const storeName = state.storeName
  const nameOf = (c: Conversation) => c.contactName?.trim() || ''
  const origin = await storefrontOriginFor(ctx.tx, ctx.storeId, opts.storefrontUrl)
  const continueUrl = `${origin}/?chat=open`

  const replyOn = await messageOn(ctx, 'chat_reply')
  const transcriptOn = await messageOn(ctx, 'chat_transcript')
  for (const c of candidates) {
    const template = shopperReplyDue(c, now)
      ? 'chat_reply'
      : transcriptDue(c, now)
        ? 'chat_transcript'
        : null
    if (!template || (template === 'chat_reply' ? !replyOn : !transcriptOn)) continue
    const to = await shopperAddress(ctx.tx, c)
    if (!to || !(await claim(ctx.tx, c, 'shopperEmailedAt', now))) continue
    const names = { shopper: nameOf(c) || 'You', store: storeName }
    const limit = template === 'chat_reply' ? REPLY_LINES : TRANSCRIPT_LINES
    const { at: _at, ...chat } = await chatLines(ctx.tx, c, limit, names, state.timeZone)
    if (chat.messages.length === 0) continue
    await sendToShopper(
      ctx,
      template,
      to,
      {
        ...plainData(storeName),
        customerName: nameOf(c),
        chat: { contactName: nameOf(c), ...chat },
        actionUrl: continueUrl,
      },
      opts,
    )
    if (template === 'chat_reply') counts.replies += 1
    else counts.transcripts += 1
  }

  counts.staff = await sendStaffWaiting(ctx, candidates, opts, now, state)
  return counts
}

/** The team email: each member with Inbox email alerts on hears about the chats that are theirs. */
async function sendStaffWaiting(
  ctx: StoreContext,
  candidates: Conversation[],
  opts: ChatEmailOptions,
  now: Date,
  state: { storeName: string; timeZone: string },
): Promise<number> {
  const due = candidates.filter((c) => staffAlertDue(c, now))
  if (due.length === 0 || !(await messageOn(ctx, 'staff_chat_waiting'))) return 0
  const members = (
    await alertMembers(ctx.tx, ctx.storeId, 'inboxMessage', permissions.INBOX_READ)
  ).filter((m) => m.prefs.inboxMessage.email)
  if (members.length === 0) return 0

  const admin = opts.adminUrl.replace(/\/+$/, '')
  const threads: { c: Conversation; thread: ChatWaitingThread }[] = []
  for (const c of due) {
    if (!(await claim(ctx.tx, c, 'unansweredAlertedAt', now))) continue
    const name = c.contactName?.trim() || c.contactEmail?.trim() || 'A visitor'
    const lines = await chatLines(
      ctx.tx,
      c,
      WAITING_LINES * 3,
      { shopper: name, store: state.storeName },
      state.timeZone,
    )
    // The shopper's lines since the store last wrote: what is waiting for an answer.
    const lastStore = lines.messages.map((m) => m.from).lastIndexOf('store')
    const waiting = lines.messages.slice(lastStore + 1).slice(-WAITING_LINES)
    const since = lines.at[lastStore + 1] ?? c.lastMessageAt
    threads.push({
      c,
      thread: {
        name,
        messages: waiting,
        waitingLabel: waitingLabel(since, now),
        url: `${admin}${conversationPath(c.id)}`,
      },
    })
  }

  let sent = 0
  for (const m of members) {
    // An assigned chat is its assignee's alone; an unassigned one goes to the whole team.
    const mine = threads.filter((t) => !t.c.assigneeUserId || t.c.assigneeUserId === m.userId)
    if (mine.length === 0) continue
    const shown = mine.slice(0, WAITING_THREADS).map((t) => t.thread)
    await deliverToMember(
      ctx,
      'staff_chat_waiting',
      m,
      { email: true, whatsapp: false, push: false },
      {
        ...plainData(state.storeName),
        chatWaiting: { threads: shown, more: mine.length - shown.length },
        actionUrl: `${admin}/sales-channels/inbox/conversations`,
      },
      opts,
    )
    sent += 1
  }
  return sent
}
