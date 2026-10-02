/**
 * Client-safe surface of the AI engine: feature names, plans and quotas, the product writer's
 * schema and choices. No SDK, no environment, safe in `'use client'` components.
 */
export { ASK_MAX_HISTORY, ASK_MAX_QUESTION, type AskLanguage } from './ask-store/prompt'
export {
  AI_FEATURES,
  type AiFeature,
  type AiFeatureToggles,
  FEATURE_MODELS,
  parseFeatureToggles,
} from './features'
export {
  AI_PLANS,
  type AiPlan,
  type AiQuota,
  type AiUsageTotals,
  aiMonth,
  checkQuota,
  DEFAULT_AI_PLAN,
  PLAN_QUOTAS,
  parseAiPlan,
} from './plans'
export {
  clampProductCopy,
  type ProductCopy,
  ProductCopySchema,
  WRITER_LANGUAGES,
  WRITER_MAX_PHOTOS,
  WRITER_TONES,
  type WriterLanguage,
  type WriterTone,
} from './product-writer/schema'
