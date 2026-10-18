/**
 * "Build with AI" in the theme editor: the merchant's request in, one library section with its
 * words filled in out. Nothing is saved: the editor shows the proposal, and Add to page puts it
 * on the canvas like any other section, saved with the page. Runs under the product writer's
 * switch and monthly allowance (Settings → AI).
 */
import {
  generateStructured,
  proposalProps,
  SectionProposalSchema,
  type SectionWriterType,
  sectionWriterContent,
  sectionWriterInstructions,
} from '@commerce/ai'
import { store, withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { type AiCallContext, finishAiCall, startAiCall } from './guard'

export type SectionProposalView = {
  type: SectionWriterType
  summary: string
  /** Text props to lay over the section's defaults. */
  props: Record<string, unknown>
}

export async function proposeSection(
  context: AiCallContext,
  input: { request: string; page: string },
  signal?: AbortSignal,
): Promise<SectionProposalView> {
  const { storeId } = context.scope
  const storeName = await withStore(context.db, storeId, async (tx) => {
    const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
    return s?.name ?? ''
  })
  const call = await startAiCall(context, 'productWriter')
  try {
    const { output, usage } = await generateStructured({
      runtime: call.runtime,
      model: call.model,
      schema: SectionProposalSchema,
      instructions: sectionWriterInstructions(storeName),
      content: sectionWriterContent(input),
      abortSignal: signal,
    })
    await finishAiCall(context.db, call, usage)
    return {
      type: output.section.type,
      summary: output.summary.trim(),
      props: proposalProps(output.section),
    }
  } catch {
    throw new ORPCError('BAD_GATEWAY', {
      message: 'The AI could not build a section this time. Please try again.',
      data: { reason: 'model_failed' },
    })
  }
}
