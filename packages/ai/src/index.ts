/**
 * `@commerce/ai`: the AI engine. Server only (it reads the platform's AI keys and pulls in the
 * AI SDK); browser code imports `@commerce/ai/client`. How to add a feature: developer docs,
 * Building → AI engine.
 */
export type { LanguageModel as AiModel } from 'ai'
export { askStoreInstructions } from './ask-store/prompt'
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
export type { ProductWriterInput } from './product-writer/prompt'
export { productWriterContent, productWriterInstructions } from './product-writer/prompt'
export {
  type AiProviderName,
  aiModel,
  aiProvider,
  isUnlimitedStore,
  modelIdFor,
} from './provider'
