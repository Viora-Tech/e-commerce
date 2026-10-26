/** SOURCE OF TRUTH: the Inbox AI agent's run — WHAT: `runInboxAiReply` answers the newest shopper message from this store's data (products, policies, the merchant's notes, the signed-in shopper's own orders) or hands the chat to a person with a summary; `enqueueInboxAiReply` queues it / WHY: one worker job per shopper message, so a slow model never holds a request or a transaction, and the AI stops the moment staff take over (design §13). */
import {
  aiModel,
  clampInboxAgent,
  descriptionText,
  generateStructured,
  INBOX_AGENT_MIN_CONFIDENCE,
  type InboxAgentHandoffReason,
  type InboxAgentInput,
  type InboxAgentOutput,
  InboxAgentSchema,
  inboxAgentContent,
  inboxAgentInstructions,
} from '@commerce/ai'
import {
  type Db,
  inboxAiEvent,
  inboxConversation,
  inboxMessage,
  order,
  page,
  product,
  type StoreTx,
  withStore,
} from '@commerce/db'
import { and, asc, desc, eq, ilike, inArray, isNotNull, ne, or } from 'drizzle-orm'
import { admitAiCall } from '../ai/quota'
import { recordAiUsage } from '../ai/usage'
import { POLICY_TYPES, policyHandle } from '../policies/client'
import { aiMayAnswer, asksForHuman } from './ai-rules'
import { messageEvents, statusEvents } from './events'
import { appendMessage, type InboxConversationRow, type InboxMessageRow } from './messages'
import { productCards } from './panel'
import type { InboxPublish } from './realtime'
import { isInboxAvailable } from './settings'
import { inboxState } from './state'

/** Queue the worker reads AI replies from. Braces keep every key on one slot. */
export const INBOX_AI_QUEUE = '{inbox}-ai-reply'

export type InboxAiJob = { storeId: string; conversationId: string; messageId: string }

export type InboxAiQueue = {
  add(
    name: string,
    data: InboxAiJob,
    opts?: { jobId?: string; attempts?: number; backoff?: { type: 'exponential'; delay: number } },
  ): Promise<unknown>
}

/** Queues the AI agent for one shopper message; the job id makes a repeat a no-op. */
export async function enqueueInboxAiReply(queue: InboxAiQueue, job: InboxAiJob): Promise<void> {
  await queue.add('reply', job, {
    jobId: `inbox-ai-${job.messageId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  })
}

/** Products the agent sees: active ones whose title matches a word of the question. */
const SEARCH_PRODUCTS = 6
/** Messages of the conversation the agent reads, newest last. */
const THREAD_TURNS = 12
/** The signed-in shopper's own orders the agent sees. */
const SHOPPER_ORDERS = 5
/** Past question-and-reply pairs the agent learns from, out of this many matching questions. */
const PAST_ANSWERS = 3
const PAST_CANDIDATES = 30

/** What a hand-off posts to the shopper, by whether staff are online now. */
const HANDOFF_LINE = {
  online: 'Connecting you to the team. Someone will reply here shortly.',
  away: 'Connecting you to the team. They are away right now and will reply here as soon as they are back.',
}

export type InboxAiRunResult =
  | { done: 'skipped'; why: string }
  | { done: 'answered'; events: InboxPublish[] }
  | { done: 'handed_off'; reason: InboxAgentHandoffReason; events: InboxPublish[] }

/** Words worth searching the catalogue for: three letters or more, at most five. */
function searchWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3)
  return [...new Set(words)].slice(0, 5)
}

/** Active products whose title matches a word of `question`, as the AI reads them. */
export async function inboxAiProducts(
  tx: StoreTx,
  question: string,
): Promise<InboxAgentInput['products']> {
  const words = searchWords(question)
  if (words.length === 0) return []
  const rows = await tx
    .select({ id: product.id, description: product.description })
    .from(product)
    .where(
      and(eq(product.status, 'active'), or(...words.map((w) => ilike(product.title, `%${w}%`)))),
    )
    .limit(SEARCH_PRODUCTS)
  const cards = await productCards(
    tx,
    rows.map((r) => r.id),
  )
  return rows.flatMap((r) => {
    const c = cards[r.id]
    if (!c || c.minPricePaise === null) return []
    return [
      {
        id: c.id,
        title: c.title,
        pricePaise: c.minPricePaise,
        inStock: c.available,
        url: `/products/${c.handle}`,
        summary: descriptionText(r.description).slice(0, 300),
      },
    ]
  })
}

/** The store's published policy pages, as the AI reads them. */
export async function inboxAiPolicies(tx: StoreTx): Promise<InboxAgentInput['policies']> {
  const rows = await tx
    .select({ title: page.title, body: page.body })
    .from(page)
    .where(and(inArray(page.handle, POLICY_TYPES.map(policyHandle)), isNotNull(page.publishedAt)))
  return rows.map((r) => ({ title: r.title, body: descriptionText(r.body).slice(0, 1500) }))
}

async function loadOrders(
  tx: StoreTx,
  customerId: string | null,
): Promise<InboxAgentInput['orders']> {
  if (!customerId) return null
  const rows = await tx
    .select({
      number: order.number,
      placedAt: order.placedAt,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      totalPaise: order.totalPaise,
    })
    .from(order)
    .where(
      and(
        eq(order.customerId, customerId),
        inArray(order.status, ['open', 'completed', 'cancelled']),
      ),
    )
    .orderBy(desc(order.placedAt))
    .limit(SHOPPER_ORDERS)
  return rows.map((o) => ({
    name: `#${o.number}`,
    placedAt: o.placedAt.toISOString().slice(0, 10),
    status: o.status === 'cancelled' ? 'cancelled' : (o.fulfillmentStatus ?? o.status),
    totalPaise: o.totalPaise,
  }))
}

/**
 * The team's past answers to questions like this one: earlier shopper messages in other chats that
 * share a word with it, each paired with the first staff reply after it. Most words in common
 * first, then the newest. Notes and cards are never examples.
 */
async function loadPastAnswers(
  tx: StoreTx,
  question: string,
  conversationId: string,
): Promise<InboxAgentInput['pastAnswers']> {
  const words = searchWords(question)
  if (words.length === 0) return []
  const m = inboxMessage
  const asked = await tx
    .select({ id: m.id, conversationId: m.conversationId, body: m.body })
    .from(m)
    .where(
      and(
        eq(m.sender, 'shopper'),
        eq(m.kind, 'text'),
        ne(m.conversationId, conversationId),
        or(...words.map((w) => ilike(m.body, `%${w}%`))),
      ),
    )
    .orderBy(desc(m.id))
    .limit(PAST_CANDIDATES)
  if (asked.length === 0) return []
  const replies = await tx
    .select({ id: m.id, conversationId: m.conversationId, body: m.body })
    .from(m)
    .where(
      and(
        eq(m.sender, 'staff'),
        eq(m.kind, 'text'),
        inArray(m.conversationId, [...new Set(asked.map((a) => a.conversationId))]),
      ),
    )
    .orderBy(asc(m.id))
  const score = (body: string) => words.filter((w) => body.toLowerCase().includes(w)).length
  // `asked` is newest first and the sort is stable, so ties keep the newest.
  const ranked = [...asked].sort((x, y) => score(y.body) - score(x.body))
  const pairs: InboxAgentInput['pastAnswers'] = []
  const used = new Set<string>()
  for (const a of ranked) {
    if (pairs.length === PAST_ANSWERS) break
    if (used.has(a.conversationId)) continue
    const reply = replies.find((r) => r.conversationId === a.conversationId && r.id > a.id)
    if (!reply?.body.trim()) continue
    used.add(a.conversationId)
    pairs.push({ question: a.body, answer: reply.body })
  }
  return pairs
}

type Loaded = {
  state: Awaited<ReturnType<typeof inboxState>>
  conversation: InboxConversationRow
  question: InboxMessageRow
  thread: InboxAgentInput['thread']
  staffReplied: boolean
}

/** Everything the decision needs, or why the AI stays quiet. */
async function load(tx: StoreTx, storeId: string, job: InboxAiJob): Promise<Loaded | string> {
  const state = await inboxState(tx, storeId)
  if (!state.installed) return 'not_installed'
  const [conversation] = await tx
    .select()
    .from(inboxConversation)
    .where(eq(inboxConversation.id, job.conversationId))
  if (!conversation) return 'no_conversation'
  const recent = await tx
    .select()
    .from(inboxMessage)
    .where(eq(inboxMessage.conversationId, conversation.id))
    .orderBy(desc(inboxMessage.id))
    .limit(THREAD_TURNS)
  const newestShopper = recent.find((m) => m.sender === 'shopper')
  // A newer shopper message has its own job: only the newest one is answered.
  if (newestShopper?.id !== job.messageId) return 'superseded'
  const [staff] = await tx
    .select({ id: inboxMessage.id })
    .from(inboxMessage)
    .where(and(eq(inboxMessage.conversationId, conversation.id), eq(inboxMessage.sender, 'staff')))
    .limit(1)
  const thread = recent
    .filter((m) => m.kind === 'text' && m.sender !== 'system' && m.body.trim())
    .reverse()
    .map((m) => ({
      from: m.sender === 'shopper' ? ('shopper' as const) : ('store' as const),
      text: m.body,
    }))
  return { state, conversation, question: newestShopper, thread, staffReplied: Boolean(staff) }
}

/** Posts the reply (and its product card) as the AI. */
async function answer(
  tx: StoreTx,
  storeId: string,
  l: Loaded,
  out: InboxAgentOutput,
  now: Date,
): Promise<InboxPublish[]> {
  const events: InboxPublish[] = []
  const text = await appendMessage(
    tx,
    storeId,
    l.conversation,
    { sender: 'ai', kind: 'text', body: out.reply, clientId: `ai-${l.question.id}` },
    now,
  )
  if (text.created) events.push(...messageEvents(storeId, l.conversation, text.message))
  if (out.productIds.length > 0) {
    const card = await appendMessage(
      tx,
      storeId,
      l.conversation,
      {
        sender: 'ai',
        kind: 'product',
        body: '',
        payload: { productIds: out.productIds },
        clientId: `ai-${l.question.id}-products`,
      },
      now,
    )
    if (card.created) events.push(...messageEvents(storeId, l.conversation, card.message))
  }
  return events
}

/** Hands the conversation to a person: a line to the shopper, Needs human and a summary for staff. */
async function handOff(
  tx: StoreTx,
  storeId: string,
  l: Loaded,
  summary: string,
  now: Date,
): Promise<InboxPublish[]> {
  const online = isInboxAvailable(l.state.settings, l.state.timeZone, now)
  const line = online ? HANDOFF_LINE.online : l.state.settings.awayMessage || HANDOFF_LINE.away
  const sent = await appendMessage(
    tx,
    storeId,
    l.conversation,
    { sender: 'ai', kind: 'text', body: line, clientId: `ai-${l.question.id}-handoff` },
    now,
  )
  const [updated] = await tx
    .update(inboxConversation)
    .set({ needsHuman: true, handoffSummary: summary || null, handoffAt: now, updatedAt: now })
    .where(eq(inboxConversation.id, l.conversation.id))
    .returning()
  const events: InboxPublish[] = []
  if (sent.created) events.push(...messageEvents(storeId, updated ?? l.conversation, sent.message))
  if (updated) events.push(...statusEvents(storeId, updated))
  return events
}

async function logEvent(
  tx: StoreTx,
  storeId: string,
  l: Loaded,
  e: {
    kind: 'answer' | 'handoff'
    reason?: InboxAgentHandoffReason | null
    confidence?: number
    inputTokens?: number
    outputTokens?: number
  },
): Promise<void> {
  await tx
    .insert(inboxAiEvent)
    .values({
      storeId,
      conversationId: l.conversation.id,
      messageId: l.question.id,
      kind: e.kind,
      reason: e.reason ?? null,
      confidence: e.confidence ?? null,
      inputTokens: e.inputTokens ?? 0,
      outputTokens: e.outputTokens ?? 0,
    })
    .onConflictDoNothing()
}

export type RunInboxAiOptions = {
  db: Db
  job: InboxAiJob
  now?: Date | undefined
  signal?: AbortSignal | undefined
  /** Tests pass a scripted model; otherwise the store's tier picks one. */
  model?: NonNullable<ReturnType<typeof aiModel>> | undefined
}

/**
 * Answers one shopper message, or hands the chat to a person. Quiet (skipped) when the store's
 * AI mode says so, staff already took over, the chat was handed off, or a newer message came in.
 * Never throws for the model's own failures: those hand off as "not confident".
 */
export async function runInboxAiReply(opts: RunInboxAiOptions): Promise<InboxAiRunResult> {
  const { db, job } = opts
  const now = opts.now ?? new Date()
  const loaded = await withStore(db, job.storeId, (tx) => load(tx, job.storeId, job))
  if (typeof loaded === 'string') return { done: 'skipped', why: loaded }
  const l = loaded
  const mayAnswer = aiMayAnswer({
    mode: l.state.settings.ai.mode,
    staffAvailable: isInboxAvailable(l.state.settings, l.state.timeZone, now),
    status: l.conversation.status,
    needsHuman: l.conversation.needsHuman,
    staffReplied: l.staffReplied,
  })
  if (!mayAnswer) return { done: 'skipped', why: 'not_allowed' }

  // Asking for a person never waits for a model.
  if (asksForHuman(l.question.body)) {
    const events = await withStore(db, job.storeId, async (tx) => {
      const out = await handOff(tx, job.storeId, l, 'The shopper asked to talk to a person.', now)
      await logEvent(tx, job.storeId, l, { kind: 'handoff', reason: 'asked_for_human' })
      return out
    })
    return { done: 'handed_off', reason: 'asked_for_human', events }
  }

  // The store's AI switch and allowance (counted under the assistant for now).
  const admission = await withStore(db, job.storeId, (tx) =>
    admitAiCall({ storeId: job.storeId, tx }, 'assistant', now),
  )
  if (!admission.ok) return { done: 'skipped', why: `ai_${admission.reason}` }
  const model = opts.model ?? aiModel('assistant', process.env, admission.tier)
  if (!model) return { done: 'skipped', why: 'ai_off' }

  const pack = await withStore(db, job.storeId, async (tx) => ({
    products: await inboxAiProducts(tx, l.question.body),
    policies: await inboxAiPolicies(tx),
    orders: await loadOrders(tx, l.conversation.customerId),
    pastAnswers: l.state.settings.ai.learn
      ? await loadPastAnswers(tx, l.question.body, l.conversation.id)
      : [],
  }))
  let out: InboxAgentOutput
  let usage = { inputTokens: 0, outputTokens: 0 }
  try {
    const result = await generateStructured({
      runtime: { storeId: job.storeId, userId: '', plan: admission.plan, feature: 'assistant' },
      model,
      schema: InboxAgentSchema,
      instructions: inboxAgentInstructions(l.state.storeName),
      content: inboxAgentContent({
        knowledge: l.state.settings.ai.knowledge,
        ...pack,
        thread: l.thread,
      }),
      abortSignal: opts.signal,
    })
    out = clampInboxAgent(
      result.output,
      pack.products.map((p) => p.id),
    )
    usage = {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    }
  } catch {
    out = {
      action: 'handoff',
      reply: '',
      productIds: [],
      handoffReason: 'not_confident',
      summary: 'The AI could not answer this message.',
      confidence: 0,
    }
  }
  const unsure = out.confidence < INBOX_AGENT_MIN_CONFIDENCE || !out.reply
  const handoff = out.action === 'handoff' || unsure
  const reason: InboxAgentHandoffReason = out.handoffReason ?? 'not_confident'

  const events = await withStore(db, job.storeId, async (tx) => {
    await recordAiUsage(
      { storeId: job.storeId, tx },
      { month: admission.month, feature: 'assistant', tier: admission.tier, ...usage },
    )
    const sent = handoff
      ? await handOff(
          tx,
          job.storeId,
          l,
          out.summary || `Shopper asked: ${l.question.body.slice(0, 200)}`,
          now,
        )
      : await answer(tx, job.storeId, l, out, now)
    await logEvent(tx, job.storeId, l, {
      kind: handoff ? 'handoff' : 'answer',
      reason: handoff ? reason : null,
      confidence: out.confidence,
      ...usage,
    })
    return sent
  })
  return handoff ? { done: 'handed_off', reason, events } : { done: 'answered', events }
}
