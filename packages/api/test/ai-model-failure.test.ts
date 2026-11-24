import { generateStructured } from '@commerce/ai'
import { textModel } from '@commerce/ai/testing'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { modelFailureFields } from '../src/services/ai/model-failure'

const runtime = {
  storeId: 'store-a',
  userId: 'user-1',
  plan: 'starter' as const,
  feature: 'productWriter' as const,
}

async function failure(answer: string, schema: z.ZodType): Promise<unknown> {
  try {
    await generateStructured({
      runtime,
      model: textModel(answer),
      schema,
      instructions: 'x',
      content: [{ type: 'text', text: 'x' }],
    })
  } catch (err) {
    return err
  }
  throw new Error('expected the call to fail')
}

describe('modelFailureFields', () => {
  it('names a schema mismatch and its paths without quoting the model answer', async () => {
    const err = await failure(
      JSON.stringify({ brands: ['SECRET-BRAND-1', 'SECRET-BRAND-2'] }),
      z.object({ brands: z.array(z.string()).max(1) }),
    )
    const fields = modelFailureFields('store_knowledge_scan', err)
    expect(fields).toMatchObject({
      task: 'store_knowledge_scan',
      errorName: 'AI_NoObjectGeneratedError',
      errorMessage: 'No object generated: response did not match schema.',
      finishReason: 'stop',
      outputTokens: 20,
      causeName: 'AI_TypeValidationError',
      issues: ['brands: too_big'],
    })
    expect(JSON.stringify(fields)).not.toContain('SECRET')
  })

  it('names a cut-off answer as a parse failure', async () => {
    const err = await failure('{"brands":["SECRET', z.object({ brands: z.array(z.string()) }))
    const fields = modelFailureFields('store_knowledge_scan', err)
    expect(fields.errorMessage).toBe('No object generated: could not parse the response.')
    expect(JSON.stringify(fields)).not.toContain('SECRET')
  })

  it('keeps a provider error message and status code', () => {
    const err = Object.assign(new Error('Invalid schema: maxItems is not supported'), {
      name: 'GatewayInvalidRequestError',
      statusCode: 400,
    })
    expect(modelFailureFields('product_writer', err)).toMatchObject({
      errorName: 'GatewayInvalidRequestError',
      errorMessage: 'Invalid schema: maxItems is not supported',
      statusCode: 400,
    })
  })
})
