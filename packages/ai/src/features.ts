/**
 * SOURCE OF TRUTH: AI features and the model each one uses — WHAT the list of AI features and
 * their model settings / WHY swapping a model, or adding a feature, is one edit here.
 * Pure and client-safe.
 */

export const AI_FEATURES = ['productWriter', 'askStore'] as const
export type AiFeature = (typeof AI_FEATURES)[number]

export type FeatureModel = {
  /**
   * Gateway model id. Vercel AI Gateway and OpenRouter share the `provider/model` form, so one
   * id works on both. `AI_MODEL` in the environment overrides every feature at once.
   */
  model: string
  maxOutputTokens: number
  temperature: number
  /** Tool-calling rounds before the answer must be written (tool features only). */
  maxSteps: number
}

/**
 * Fast, cheap and good at following a schema: Claude Haiku 4.5 ($1 in / $5 out per million
 * tokens) reads photos and calls tools well. Rough cost per call: product write ~$0.009
 * (~5k in, ~800 out, three photos), store question ~$0.01 (~8k in over 2-3 steps, ~400 out).
 */
export const FEATURE_MODELS: Record<AiFeature, FeatureModel> = {
  productWriter: {
    model: 'anthropic/claude-haiku-4.5',
    maxOutputTokens: 1_800,
    temperature: 0.7,
    maxSteps: 1,
  },
  askStore: {
    model: 'anthropic/claude-haiku-4.5',
    maxOutputTokens: 900,
    temperature: 0.2,
    maxSteps: 5,
  },
}

/** Every feature is on until the store turns it off in Settings → AI. */
export type AiFeatureToggles = Record<AiFeature, boolean>

/** Stored toggles (a partial object, possibly junk) with the missing ones on. */
export function parseFeatureToggles(raw: unknown): AiFeatureToggles {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return Object.fromEntries(
    AI_FEATURES.map((feature) => [feature, source[feature] !== false]),
  ) as AiFeatureToggles
}
