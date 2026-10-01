/**
 * SOURCE OF TRUTH: which AI provider and model a call uses — WHAT reads AI_PROVIDER and the
 * gateway keys, and turns a feature into a model / WHY "is AI on?" has one answer everywhere
 * (no key, no AI buttons). Keys come from the platform's environment only; merchants never
 * bring their own and nothing here stores or logs them.
 */

import { createGateway } from '@ai-sdk/gateway'
import { loadAiEnv } from '@commerce/config'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import { type AiFeature, FEATURE_MODELS } from './features'
import { mockModel } from './mock'

export type AiProviderName = 'gateway' | 'openrouter' | 'mock'

type Env = Record<string, string | undefined>

/** The provider AI calls go through right now, or null when AI is off. */
export function aiProvider(source: Env = process.env): AiProviderName | null {
  const env = loadAiEnv(source)
  const gateway = env.AI_GATEWAY_API_KEY ? 'gateway' : null
  const openrouter = env.OPENROUTER_API_KEY ? 'openrouter' : null
  switch (env.AI_PROVIDER) {
    case 'off':
      return null
    case 'mock':
      // The fake model must never answer a real merchant.
      return env.NODE_ENV === 'production' ? null : 'mock'
    case 'gateway':
      return gateway
    case 'openrouter':
      return openrouter
    default:
      return gateway ?? openrouter
  }
}

/** The model id a feature uses: `AI_MODEL` when set, else the feature's default. */
export function modelIdFor(feature: AiFeature, source: Env = process.env): string {
  return loadAiEnv(source).AI_MODEL ?? FEATURE_MODELS[feature].model
}

/** Whether a store (by slug) is on the unlimited plan through `AI_UNLIMITED_STORES`. */
export function isUnlimitedStore(slug: string, source: Env = process.env): boolean {
  return loadAiEnv(source).AI_UNLIMITED_STORES.includes(slug.toLowerCase())
}

/** The model for one feature, or null when AI is off. */
export function aiModel(feature: AiFeature, source: Env = process.env): LanguageModel | null {
  const provider = aiProvider(source)
  if (!provider) return null
  const env = loadAiEnv(source)
  const id = modelIdFor(feature, source)
  if (provider === 'mock') return mockModel(feature)
  // `aiProvider` only picks a gateway whose key is set, so the fallbacks never apply.
  if (provider === 'gateway') return createGateway({ apiKey: env.AI_GATEWAY_API_KEY ?? '' })(id)
  return createOpenRouter({ apiKey: env.OPENROUTER_API_KEY ?? '' }).chat(id)
}
