/**
 * AI help for staff in the admin Inbox: reply drafts for the shopper's latest message, and a
 * short summary of a long chat. Nothing is sent or saved: a person picks a draft, edits it in
 * the reply box and sends it. Both run under the assistant's switch and monthly allowance
 * (Settings → AI), like the shopper-facing Inbox AI agent. The shopper's orders reach the
 * prompt only for a signed-in shopper and a member who may read orders.
 */
import {
  aiProvider,
  clampSuggestions,
  clampSummary,
  generateStructured,
  InboxSuggestSchema,
  type InboxSummaryLanguage,
  type InboxSummaryOutput,
  InboxSummarySchema,
  inboxSuggestContent,
  inboxSuggestInstructions,
  inboxSummaryContent,
  inboxSummaryInstructions,
} from '@commerce/ai'
import { CommerceError, loadAiSettings, permissions } from '@commerce/core'
import { type InboxAssistContext, inboxAssistContext } from '@commerce/core/inbox/server'
import { withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { type AiCallContext, finishAiCall, startAiCall } from './guard'

const MODEL_FAILED = () =>
  new ORPCError('BAD_GATEWAY', {
    message: 'The AI could not finish this time. Please try again.',
    data: { reason: 'model_failed' },
  })

async function loadContext(
  context: AiCallContext,
  conversationId: string,
): Promise<InboxAssistContext> {
  const { storeId } = context.scope
  try {
    const found = await withStore(context.db, storeId, (tx) =>
      inboxAssistContext({ storeId, tx }, conversationId, {
        ordersAllowed: context.scope.can(permissions.ORDERS_READ),
      }),
    )
    if (!found.installed) {
      throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Inbox app first' })
    }
    return found
  } catch (err) {
    if (err instanceof CommerceError) throw new ORPCError('NOT_FOUND', { message: err.message })
    throw err
  }
}

/** Whether the Inbox's AI help shows: AI is set up and the store has the assistant on. */
export async function inboxAiAvailable(context: AiCallContext): Promise<{ available: boolean }> {
  if (aiProvider() === null) return { available: false }
  const { storeId } = context.scope
  const settings = await withStore(context.db, storeId, (tx) => loadAiSettings({ storeId, tx }))
  return { available: settings.features.assistant }
}

/** One to three reply drafts for the shopper's latest message; none when a reply is not due. */
export async function suggestInboxReplies(
  context: AiCallContext,
  conversationId: string,
  signal?: AbortSignal,
): Promise<{ replies: string[] }> {
  const found = await loadContext(context, conversationId)
  if (!found.awaitsReply) return { replies: [] }
  const call = await startAiCall(context, 'assistant')
  try {
    const { output, usage } = await generateStructured({
      runtime: call.runtime,
      model: call.model,
      schema: InboxSuggestSchema,
      instructions: inboxSuggestInstructions(found.storeName),
      content: inboxSuggestContent(found.input),
      abortSignal: signal,
    })
    await finishAiCall(context.db, call, usage)
    return { replies: clampSuggestions(output) }
  } catch {
    throw MODEL_FAILED()
  }
}

/** What the chat is about and what the shopper still waits for, in the member's language. */
export async function summariseInboxChat(
  context: AiCallContext,
  input: { id: string; language: InboxSummaryLanguage },
  signal?: AbortSignal,
): Promise<InboxSummaryOutput> {
  const found = await loadContext(context, input.id)
  const call = await startAiCall(context, 'assistant')
  try {
    const { output, usage } = await generateStructured({
      runtime: call.runtime,
      model: call.model,
      schema: InboxSummarySchema,
      instructions: inboxSummaryInstructions(input.language),
      content: inboxSummaryContent(found.input),
      abortSignal: signal,
    })
    await finishAiCall(context.db, call, usage)
    return clampSummary(output)
  } catch {
    throw MODEL_FAILED()
  }
}
