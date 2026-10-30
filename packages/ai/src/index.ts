/**
 * `@commerce/ai`: the AI engine. Server only (it reads the platform's AI keys and pulls in the
 * AI SDK); browser code imports `@commerce/ai/client`. How to add a feature or an assistant
 * tool: developer docs, Building → AI engine and AI assistant.
 */
export type { LanguageModel as AiModel } from 'ai'
export { assistantInstructions } from './assistant/prompt'
export {
  CAMPAIGN_WRITER_MARKER,
  type CampaignCopy,
  CampaignCopySchema,
  campaignWriterContent,
  campaignWriterInstructions,
  clampCampaignCopy,
} from './campaign-writer'
export * from './client'
export {
  type AiContent,
  type AiMessage,
  type AiRuntime,
  type AiStreamEvent,
  type AiTool,
  type AiToolSet,
  type AiUsage,
  defineAiTool,
  generateStructured,
  streamAnswer,
} from './engine'
export {
  clampInboxAgent,
  INBOX_AGENT_HANDOFF_REASONS,
  INBOX_AGENT_MARKER,
  INBOX_AGENT_MIN_CONFIDENCE,
  INBOX_AGENT_PRODUCTS_MAX,
  INBOX_AGENT_REPLY_MAX,
  type InboxAgentHandoffReason,
  type InboxAgentInput,
  type InboxAgentOrder,
  type InboxAgentOutput,
  type InboxAgentProduct,
  InboxAgentSchema,
  inboxAgentContent,
  inboxAgentInstructions,
} from './inbox-agent'
export {
  clampSuggestions,
  clampSummary,
  INBOX_SUGGEST_MARKER,
  INBOX_SUGGEST_MAX,
  INBOX_SUMMARY_MARKER,
  type InboxAssistInput,
  type InboxAssistOrder,
  type InboxAssistShippingRate,
  type InboxSuggestOutput,
  InboxSuggestSchema,
  type InboxSummaryLanguage,
  type InboxSummaryOutput,
  InboxSummarySchema,
  inboxSuggestContent,
  inboxSuggestInstructions,
  inboxSummaryContent,
  inboxSummaryInstructions,
} from './inbox-assist'
export type { ProductWriterInput } from './product-writer/prompt'
export { productWriterContent, productWriterInstructions } from './product-writer/prompt'
export {
  type AiProviderName,
  aiModel,
  aiProvider,
  isUnlimitedStore,
  modelIdFor,
  modelIdForTier,
} from './provider'
export { MOCK_DOCUMENTS } from './purchase-documents/fixtures'
export {
  documentReaderContent,
  documentReaderInstructions,
  pdfText,
} from './purchase-documents/prompt'
export { DOCUMENT_SCHEMAS } from './purchase-documents/schema'
export {
  type QueryWriterOutput,
  QueryWriterSchema,
  queryWriterContent,
  queryWriterInstructions,
} from './query-writer'
export {
  clampReply,
  type ReviewReply,
  ReviewReplySchema,
  reviewReplyContent,
  reviewReplyInstructions,
} from './review-reply'
export {
  clampReviewSummary,
  REVIEW_SUMMARY_MAX,
  REVIEW_SUMMARY_REVIEWS,
  type ReviewSummary,
  ReviewSummarySchema,
  reviewSummaryContent,
  reviewSummaryInstructions,
} from './review-summary'
export {
  proposalProps,
  SECTION_WRITER_TYPES,
  type SectionProposal,
  SectionProposalSchema,
  type SectionWriterType,
  sectionWriterContent,
  sectionWriterInstructions,
} from './section-writer'
export {
  type SeoKeywordsInput,
  seoKeywordsContent,
  seoKeywordsInstructions,
} from './seo-keywords/prompt'
