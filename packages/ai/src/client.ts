/**
 * Client-safe surface of the AI engine: feature names, model tiers, plans and quotas, the
 * assistant's limits, page context and theme editor outline, the product writer's schema and
 * choices, the SEO keyword schema and list helpers. No SDK, no environment, safe in
 * `'use client'` components.
 */
export {
  ASSISTANT_LIMITS,
  ASSISTANT_MAX_HISTORY,
  ASSISTANT_MAX_MESSAGE,
  ASSISTANT_PAGES,
  type AssistantPage,
  type AssistantPageContext,
  pageContextFor,
} from './assistant/limits'
export type { AssistantLanguage } from './assistant/prompt'
export {
  fitOutline,
  outlineText,
  THEME_OUTLINE_LIMITS,
  THEME_SETTING_KINDS,
  type ThemeEditChange,
  ThemeEditInput,
  type ThemeEditRequest,
  type ThemeEditView,
  type ThemeOutline,
  type ThemeOutlineBlock,
  ThemeOutlineSchema,
  type ThemeOutlineSection,
  type ThemeOutlineSetting,
  type ThemeSettingKind,
  type ThemeValue,
  themeOutlineForPrompt,
  validateThemeEdits,
} from './assistant/theme-outline'
export {
  AI_FEATURES,
  type AiFeature,
  type AiFeatureToggles,
  FEATURE_MODELS,
  MODEL_TIERS,
  type ModelTier,
  parseFeatureToggles,
  parseWritingQuality,
  TIER_CALL_WEIGHT,
  tierFor,
  WRITING_QUALITIES,
  type WritingQuality,
} from './features'
export {
  DATA_RULES,
  type GuardedText,
  guardData,
  HIDDEN_DATA,
  looksLikeInstructions,
} from './guard-text'
export {
  AI_PLANS,
  type AiPlan,
  type AiQuota,
  type AiUsageTotals,
  aiMonth,
  checkQuota,
  creditMillisFor,
  DEFAULT_AI_PLAN,
  PLAN_QUOTAS,
  parseAiPlan,
  RUPEES_PER_CREDIT,
  TIER_PRICES_INR,
} from './plans'
export {
  BULK_WRITE_FIELDS,
  BULK_WRITE_MAX,
  type BulkWriteField,
  bulkCallsPerProduct,
  writesCopy,
} from './product-writer/bulk'
export {
  appendSpecs,
  type CopyDoc,
  type CopyNode,
  descriptionFromCopy,
  descriptionFromText,
  descriptionText,
  newTags,
} from './product-writer/description'
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
export {
  type BillOfEntry,
  BillOfEntrySchema,
  DOCUMENT_SHAPES,
  type DocumentShape,
  type ExtractedDocument,
  LOW_CONFIDENCE,
  parseExtracted,
  type ServiceBill,
  ServiceBillSchema,
  type SupplierInvoice,
  SupplierInvoiceSchema,
} from './purchase-documents/schema'
export { QUERY_WRITER_REQUEST_MAX } from './query-writer'
export {
  addKeyword,
  clampKeywords,
  containsKeyword,
  KEYWORD_INTENTS,
  type KeywordIntent,
  keywordList,
  makePrimary,
  mergeKeywords,
  normaliseKeyword,
  parseSuggestedKeywords,
  SEO_KEYWORD_LENGTH_MAX,
  SEO_KEYWORDS_MAX,
  type SeoKeywordsOutput,
  SeoKeywordsSchema,
  type SuggestedKeyword,
} from './seo-keywords/schema'
