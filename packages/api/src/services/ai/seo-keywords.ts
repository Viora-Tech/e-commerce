/**
 * "Suggest keywords" (product page, Search keywords card): the product's facts in (title, brand,
 * type, category, description, price, the keywords it has now) plus, when the store connected
 * Google Search Console, the queries that already brought visitors to its page; 5-10 search
 * keywords out, each with an intent and one primary pick. Nothing is saved here: the merchant
 * picks on the card and saves the product as usual. Runs under the product writer's switch and
 * monthly allowance (Settings → AI). No customer data is sent.
 */
import {
  clampKeywords,
  generateStructured,
  SeoKeywordsSchema,
  type SuggestedKeyword,
  seoKeywordsContent,
  seoKeywordsInstructions,
} from '@commerce/ai'
import { categoryPath, productSearchQueries } from '@commerce/core'
import { withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { type AiCallContext, finishAiCall, startAiCall } from './guard'

export type SuggestKeywordsInput = {
  /** The saved product, for its Search Console queries; null while it is new. */
  productId: string | null
  title: string
  productType: string
  vendor: string
  categoryId: string | null
  /** The description as plain text. */
  description: string
  minPricePaise: number | null
  maxPricePaise: number | null
  current: string[]
}

export type SuggestKeywordsResult = {
  keywords: SuggestedKeyword[]
  /** How many real Search Console queries grounded the suggestions (0 without a connection). */
  searchQueries: number
}

export async function suggestKeywords(
  context: AiCallContext,
  input: SuggestKeywordsInput,
  signal?: AbortSignal,
): Promise<SuggestKeywordsResult> {
  const { storeId } = context.scope
  const call = await startAiCall(context, 'productWriter')
  const searchQueries = await withStore(context.db, storeId, (tx) =>
    productSearchQueries(tx, storeId, input.productId),
  )
  try {
    const { output, usage } = await generateStructured({
      runtime: call.runtime,
      model: call.model,
      schema: SeoKeywordsSchema,
      instructions: seoKeywordsInstructions(),
      content: seoKeywordsContent({
        title: input.title,
        productType: input.productType,
        vendor: input.vendor,
        category: await categoryPath(input.categoryId),
        description: input.description,
        minPricePaise: input.minPricePaise,
        maxPricePaise: input.maxPricePaise,
        searchQueries,
        current: input.current,
      }),
      abortSignal: signal,
    })
    await finishAiCall(context.db, call, usage)
    const seen = searchQueries.map((q) => q.query)
    return { keywords: clampKeywords(output, seen), searchQueries: searchQueries.length }
  } catch {
    throw new ORPCError('BAD_GATEWAY', {
      message: 'The AI could not suggest keywords this time. Please try again.',
      data: { reason: 'model_failed' },
    })
  }
}
