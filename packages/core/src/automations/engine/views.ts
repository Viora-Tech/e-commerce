/** SOURCE OF TRUTH: Automations editor views — WHAT: the piece catalogue, template gallery and plan usage one store sees, without the zod schemas / WHY: the editor's pickers, the gallery and the usage meter read exactly what publish will accept for this store (design §8.4, §8.8, §8.5 limits). */
import type { StoreTx } from '@commerce/db'
import type { PluginManifest } from '@commerce/plugins'
import { PLANS } from '../../billing/plans'
import type { AutomationUsage, CatalogueView, TemplateView } from '../api-types'
import { CONDITION_FIELDS } from '../catalogue'
import { actionIdsOf } from '../definition'
import { BUILTIN_TEMPLATES } from '../templates'
import { storePieces } from './resolve'
import { activeWorkflowCount, runsThisMonth, storePlanId, usageMonth } from './usage'

/** The editor's pickers for this store. */
export async function catalogueView(
  tx: StoreTx,
  storeId: string,
  plugins: readonly PluginManifest[],
): Promise<CatalogueView> {
  const { catalogue } = await storePieces(tx, storeId, plugins)
  const strip = <T extends { configSchema: unknown }>({ configSchema: _s, ...rest }: T) => rest
  const pluginFields: CatalogueView['pluginFields'] = {}
  for (const p of plugins) {
    for (const t of p.automations?.triggers ?? []) {
      pluginFields[t.id] = (t.fields ?? []).map((f) => ({
        path: f.path,
        labelKey: f.path,
        subject: 'none',
        type: f.type,
        ...(f.options ? { options: f.options } : {}),
      }))
    }
  }
  return {
    triggers: catalogue.triggers.map(strip),
    actions: catalogue.actions.map(strip),
    fields: [...CONDITION_FIELDS],
    pluginFields,
  }
}

/** Built-in and installed apps' templates. Growth's six are added by the Growth migration. */
export async function templateViews(
  tx: StoreTx,
  storeId: string,
  plugins: readonly PluginManifest[],
): Promise<TemplateView[]> {
  const { catalogue, plugins: installed } = await storePieces(tx, storeId, plugins)
  const builtin = BUILTIN_TEMPLATES.map(
    (t): TemplateView => ({
      id: t.id,
      nameKey: t.nameKey,
      descriptionKey: t.descriptionKey,
      name: null,
      description: null,
      category: t.category,
      triggerType: t.definition.trigger.type,
      pluginId: null,
      available:
        catalogue.trigger(t.definition.trigger.type) !== null &&
        actionIdsOf(t.definition).every((a) => catalogue.action(a) !== null),
    }),
  )
  const fromApps = installed.flatMap((p) =>
    (p.automations?.templates ?? []).map(
      (t): TemplateView => ({
        id: `${p.id}/${t.id}`,
        nameKey: null,
        descriptionKey: null,
        name: t.name.en,
        description: t.description.en,
        category: t.category,
        triggerType: String((t.definition.trigger as { type?: unknown } | undefined)?.type ?? ''),
        pluginId: p.id,
        available: true,
      }),
    ),
  )
  return [...builtin, ...fromApps]
}

export async function automationUsage(
  tx: StoreTx,
  storeId: string,
  plugins: readonly PluginManifest[],
): Promise<AutomationUsage> {
  const plan = await storePlanId(tx, storeId)
  const limits = PLANS[plan].automations
  const [runs, active, pieces] = await Promise.all([
    runsThisMonth(tx, storeId),
    activeWorkflowCount(tx, storeId),
    storePieces(tx, storeId, plugins),
  ])
  return {
    month: usageMonth(),
    runs,
    runsLimit: limits.runsPerMonth,
    activeWorkflows: active,
    activeLimit: limits.activeWorkflows,
    connectors: limits.connectors,
    appInstalled: pieces.appInstalled,
  }
}
