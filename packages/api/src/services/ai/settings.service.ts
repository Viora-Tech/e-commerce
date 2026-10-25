/**
 * What the admin needs to show AI: whether it is configured, which features this member may
 * use (the buttons), and the store's usage this month against its plan, its switches and its
 * writing quality (Settings → AI).
 */
import {
  type AiFeature,
  type AiFeatureToggles,
  type AiPlan,
  type AiQuota,
  aiMonth,
  aiProvider,
  type ModelTier,
  modelIdForTier,
  PLAN_QUOTAS,
  type WritingQuality,
} from '@commerce/ai'
import {
  type AiMonthUsage,
  aiUsageForMonth,
  loadAiSettings,
  type Permission,
  permissions,
  type StoreContext,
  saveAiFeatures,
} from '@commerce/core'
import { aiStoreFacts, effectiveAiPlan } from '@commerce/core/ai-runtime'
import type { StoreScope } from '../../procedures'
import { ASSISTANT_PERMISSIONS } from './assistant/registry'

export type AiStatus = {
  /** A gateway key is set (or the dev mock is on). False: hide every AI button. */
  configured: boolean
  /** Which AI buttons this member sees: configured, turned on for the store, and allowed by their role. */
  productWriter: boolean
  assistant: boolean
  bulkWriter: boolean
  /** "Read with AI" on purchase documents. */
  documentReader: boolean
}

/** Each feature's permission: the same one its procedure checks (any one of them, for the assistant). */
const FEATURE_PERMISSION: Record<AiFeature, readonly Permission[]> = {
  productWriter: [permissions.PRODUCTS_WRITE],
  assistant: ASSISTANT_PERMISSIONS,
  bulkWriter: [permissions.PRODUCTS_WRITE],
  documentReader: [permissions.INVENTORY_WRITE],
}

export async function aiStatus(ctx: StoreContext, scope: StoreScope): Promise<AiStatus> {
  const configured = aiProvider() !== null
  if (!configured) {
    return {
      configured,
      productWriter: false,
      assistant: false,
      bulkWriter: false,
      documentReader: false,
    }
  }
  const { features } = await loadAiSettings(ctx)
  const allowed = (f: AiFeature) => features[f] && FEATURE_PERMISSION[f].some(scope.can)
  return {
    configured,
    productWriter: allowed('productWriter'),
    assistant: allowed('assistant'),
    bulkWriter: allowed('bulkWriter'),
    documentReader: allowed('documentReader'),
  }
}

export type AiSettingsView = {
  configured: boolean
  provider: 'gateway' | 'openrouter' | 'mock' | null
  plan: AiPlan
  quota: AiQuota
  usage: AiMonthUsage
  features: AiFeatureToggles
  writingQuality: WritingQuality
  /** Bought credits still left; used after the month's allowance (`quota.credits`). */
  extraCredits: number
  /** The model id behind each tier: fast (chat, tools) and strong ("Best" writing). */
  models: Record<ModelTier, string>
}

export async function aiSettingsView(ctx: StoreContext): Promise<AiSettingsView> {
  const settings = await loadAiSettings(ctx)
  const facts = await aiStoreFacts(ctx.tx, ctx.storeId)
  const usage = await aiUsageForMonth(ctx, aiMonth())
  const plan = effectiveAiPlan(facts.slug, settings.plan)
  const provider = aiProvider()
  return {
    configured: provider !== null,
    provider,
    plan,
    quota: PLAN_QUOTAS[plan],
    usage,
    features: settings.features,
    writingQuality: settings.writingQuality,
    extraCredits: settings.extraCredits,
    models: { fast: modelIdForTier('fast'), strong: modelIdForTier('strong') },
  }
}

export async function saveAiSettings(
  ctx: StoreContext,
  input: { features: Partial<AiFeatureToggles>; writingQuality?: WritingQuality | undefined },
): Promise<AiSettingsView> {
  await saveAiFeatures(ctx, input.features, input.writingQuality)
  return aiSettingsView(ctx)
}
