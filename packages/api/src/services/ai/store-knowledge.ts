/**
 * "Scan my store" on Agentic sales → Knowledge base: the store's public content in, draft facts
 * out, merged so nothing the merchant published or wrote changes. Runs under the product
 * writer's switch and monthly allowance (Settings → AI). Only public store content is sent:
 * description, About page, published policies, brands, types, collections, product titles.
 */
import {
  generateStructured,
  STORE_KNOWLEDGE_MAX_OUTPUT_TOKENS,
  type StoreKnowledgeDraft,
  StoreKnowledgeSchema,
  storeKnowledgeContent,
  storeKnowledgeInstructions,
} from '@commerce/ai'
import { type AgentKnowledge, applyKnowledgeDraft, loadKnowledgeSources } from '@commerce/core'
import { withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { type AiCallContext, finishAiCall, startAiCall } from './guard'
import { logModelFailure } from './model-failure'

export async function scanStoreKnowledge(
  context: AiCallContext,
  signal?: AbortSignal,
): Promise<AgentKnowledge> {
  const { storeId } = context.scope
  const sources = await withStore(context.db, storeId, (tx) =>
    loadKnowledgeSources({ tx, storeId }),
  )
  const call = await startAiCall(context, 'productWriter')
  let d: StoreKnowledgeDraft
  try {
    const { output, usage } = await generateStructured({
      runtime: call.runtime,
      model: call.model,
      schema: StoreKnowledgeSchema,
      instructions: storeKnowledgeInstructions(sources.storeName),
      content: storeKnowledgeContent(sources),
      abortSignal: signal,
      maxOutputTokens: STORE_KNOWLEDGE_MAX_OUTPUT_TOKENS,
    })
    await finishAiCall(context.db, call, usage)
    d = output
  } catch (err) {
    logModelFailure('store_knowledge_scan', err)
    throw new ORPCError('BAD_GATEWAY', {
      message: 'The AI could not finish the scan this time. Please try again.',
      data: { reason: 'model_failed' },
    })
  }
  return withStore(context.db, storeId, (tx) =>
    applyKnowledgeDraft(
      { tx, storeId },
      {
        description: { text: d.description },
        audience: { text: d.audience },
        founded: { text: d.founded },
        location: { text: d.location },
        brands: { tags: d.brands },
        categories: { tags: d.categories },
        values: { tags: d.values },
        style: { text: d.style },
        shipping: { text: d.shipping },
        payments: { text: d.payments },
        returns: { text: d.returns },
        support: { text: d.support },
        faq: { faq: d.faq },
      },
    ),
  )
}
