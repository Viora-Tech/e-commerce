/**
 * SOURCE OF TRUTH: AI features, model routing and the model each one uses — WHAT the list of
 * AI features, the two model tiers (fast and strong) and their settings / WHY swapping a
 * model, routing a feature to another tier, or adding a feature, is one edit here.
 * Pure and client-safe.
 */

export const AI_FEATURES = ['productWriter', 'assistant', 'bulkWriter'] as const
export type AiFeature = (typeof AI_FEATURES)[number]

/**
 * The two models every call is routed to. Vercel AI Gateway and OpenRouter share the
 * `provider/model` form, so one id works on both. `AI_MODEL` overrides `fast` and
 * `AI_MODEL_STRONG` overrides `strong` from the environment.
 *
 * - fast: Claude Haiku 4.5 ($1 in / $5 out per million tokens). Chat, tool calls, quick
 *   writing. Reads photos and follows a schema well.
 * - strong: Claude Sonnet 4.5 ($3 in / $15 out). Long writing when a store picks "Best"
 *   writing quality in Settings → AI.
 */
export const MODEL_TIERS = {
  fast: 'anthropic/claude-haiku-4.5',
  strong: 'anthropic/claude-sonnet-4.5',
} as const
export type ModelTier = keyof typeof MODEL_TIERS

/**
 * How many requests of the monthly allowance one call costs. The strong model costs about
 * three times as much per token, so one "Best" write counts as three requests.
 */
export const TIER_CALL_WEIGHT: Record<ModelTier, number> = { fast: 1, strong: 3 }

/** The store's writing quality (Settings → AI): which tier the writer features use. */
export const WRITING_QUALITIES = ['standard', 'best'] as const
export type WritingQuality = (typeof WRITING_QUALITIES)[number]

export type FeatureModel = {
  /** Tier the feature uses at "standard" quality. */
  tier: ModelTier
  /** True for long-writing features: "Best" writing quality moves them to the strong tier. */
  writes: boolean
  maxOutputTokens: number
  temperature: number
  /** Tool-calling rounds before the answer must be written (tool features only). */
  maxSteps: number
}

/**
 * Rough cost per call on the fast tier: product write ~$0.009 (~5k in, ~800 out, three
 * photos), assistant turn ~$0.012 (~9k in over 2-4 steps, ~500 out).
 */
export const FEATURE_MODELS: Record<AiFeature, FeatureModel> = {
  productWriter: {
    tier: 'fast',
    writes: true,
    maxOutputTokens: 1_800,
    temperature: 0.7,
    maxSteps: 1,
  },
  assistant: {
    tier: 'fast',
    writes: false,
    maxOutputTokens: 1_400,
    temperature: 0.2,
    maxSteps: 6,
  },
  bulkWriter: {
    tier: 'fast',
    writes: true,
    maxOutputTokens: 1_800,
    temperature: 0.7,
    maxSteps: 1,
  },
}

/** The tier one call of `feature` runs on for a store at `quality`. */
export function tierFor(feature: AiFeature, quality: WritingQuality = 'standard'): ModelTier {
  const settings = FEATURE_MODELS[feature]
  return settings.writes && quality === 'best' ? 'strong' : settings.tier
}

/** Every feature is on until the store turns it off in Settings → AI. */
export type AiFeatureToggles = Record<AiFeature, boolean>

/**
 * Stored toggles (a partial object, possibly junk) with the missing ones on. `askStore` is the
 * assistant's name before AI v2: a store that turned it off keeps the assistant off.
 */
export function parseFeatureToggles(raw: unknown): AiFeatureToggles {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const legacy: Record<string, unknown> =
    source.assistant === undefined && source.askStore === false ? { assistant: false } : {}
  const merged = { ...source, ...legacy }
  return Object.fromEntries(
    AI_FEATURES.map((feature) => [feature, merged[feature] !== false]),
  ) as AiFeatureToggles
}

/** Narrows a stored value to a writing quality, falling back to standard. */
export function parseWritingQuality(value: unknown): WritingQuality {
  return WRITING_QUALITIES.includes(value as WritingQuality)
    ? (value as WritingQuality)
    : 'standard'
}
