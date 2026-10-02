/**
 * What the admin needs to show AI: whether it is configured, which features this member may
 * use (the buttons), and the store's usage this month against its plan (Settings → AI).
 */
import {
  type AiFeature,
  type AiFeatureToggles,
  type AiPlan,
  type AiQuota,
  aiMonth,
  aiProvider,
  modelIdFor,
  PLAN_QUOTAS,
} from '@commerce/ai'
import {
  type AiMonthUsage,
  aiUsageForMonth,
  loadAiSettings,
  permissions,
  type StoreContext,
  saveAiFeatures,
} from '@commerce/core'
import type { StoreScope } from '../../procedures'
import { effectivePlan, storeFacts } from './guard'

export type AiStatus = {
  /** A gateway key is set (or the dev mock is on). False: hide every AI button. */
  configured: boolean
  /** Which AI buttons this member sees: configured, turned on for the store, and allowed by their role. */
  productWriter: boolean
  askStore: boolean
}

/** Each feature's permission: the same one its procedure checks. */
const FEATURE_PERMISSION = {
  productWriter: permissions.PRODUCTS_WRITE,
  askStore: permissions.ANALYTICS_READ,
} as const satisfies Record<AiFeature, unknown>

export async function aiStatus(ctx: StoreContext, scope: StoreScope): Promise<AiStatus> {
  const configured = aiProvider() !== null
  if (!configured) return { configured, productWriter: false, askStore: false }
  const { features } = await loadAiSettings(ctx)
  const allowed = (f: AiFeature) => features[f] && scope.can(FEATURE_PERMISSION[f])
  return { configured, productWriter: allowed('productWriter'), askStore: allowed('askStore') }
}

export type AiSettingsView = {
  configured: boolean
  provider: 'gateway' | 'openrouter' | 'mock' | null
  plan: AiPlan
  quota: AiQuota
  usage: AiMonthUsage
  features: AiFeatureToggles
  models: Record<AiFeature, string>
}

export async function aiSettingsView(ctx: StoreContext): Promise<AiSettingsView> {
  const settings = await loadAiSettings(ctx)
  const facts = await storeFacts(ctx.tx, ctx.storeId)
  const usage = await aiUsageForMonth(ctx, aiMonth())
  const plan = effectivePlan(facts.slug, settings.plan)
  const provider = aiProvider()
  return {
    configured: provider !== null,
    provider,
    plan,
    quota: PLAN_QUOTAS[plan],
    usage,
    features: settings.features,
    models: { productWriter: modelIdFor('productWriter'), askStore: modelIdFor('askStore') },
  }
}

export async function saveAiSettings(
  ctx: StoreContext,
  features: Partial<AiFeatureToggles>,
): Promise<AiSettingsView> {
  await saveAiFeatures(ctx, features)
  return aiSettingsView(ctx)
}
