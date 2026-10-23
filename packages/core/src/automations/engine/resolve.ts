/** SOURCE OF TRUTH: automation piece resolution per store — WHAT: which apps a store installed, its piece catalogue (built-ins plus installed apps' triggers and actions), and the action resolver the interpreter and dry run use, wrapping plugin actions as executors / WHY: the API, the worker and the dry run must see the same pieces for a store, and plugin actions must follow the same retry contract as built-ins (design §8.9). */
import { type StoreTx, store } from '@commerce/db'
import type { AppHookContext, PluginManifest } from '@commerce/plugins'
import { eq } from 'drizzle-orm'
import { parseAppsSettings } from '../../apps/settings'
import { AUTOMATIONS_APP_ID } from '../app'
import { type ActionExecutor, AutomationActionError } from '../executor'
import { actionExecutor, type PieceCatalogue, pieceCatalogue, pluginAction } from '../registry'
import type { ResolvedAction } from './interpreter'

export type StorePieces = {
  appInstalled: boolean
  installed: string[]
  plugins: PluginManifest[]
  catalogue: PieceCatalogue
}

/** The store's installed apps and the pieces they unlock. `plugins` is the deployment's list. */
export async function storePieces(
  tx: StoreTx,
  storeId: string,
  plugins: readonly PluginManifest[],
): Promise<StorePieces> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const installed = parseAppsSettings(s?.apps).installed
  const installedPlugins = plugins.filter((p) => installed.includes(p.id))
  const appInstalled = installed.includes(AUTOMATIONS_APP_ID)
  return {
    appInstalled,
    installed,
    plugins: installedPlugins,
    catalogue: pieceCatalogue({ installedPlugins, appInstalled }),
  }
}

/** A plugin action's `run` as an executor; `context` builds the app's hook context. */
function pluginExecutor(
  manifest: NonNullable<ReturnType<typeof pluginAction>>,
  context: ((storeId: string, pluginId: string) => Promise<AppHookContext>) | null,
): ActionExecutor {
  const pluginId = manifest.id.split('/')[0] as string
  return {
    id: manifest.id,
    async run({ ctx, config }) {
      if (!context) throw new AutomationActionError('Apps cannot run here', { retryable: true })
      const hook = await context(ctx.storeId, pluginId)
      try {
        const r = await manifest.run(hook, {
          stepRunId: ctx.stepKey,
          subject: ctx.subject,
          config,
          data: ctx.data,
        })
        const output =
          r.output && typeof r.output === 'object' ? (r.output as Record<string, unknown>) : {}
        return { output, summary: `Ran ${manifest.label.en}` }
      } catch (err) {
        if (err instanceof AutomationActionError) throw err
        const retryable = Boolean((err as { retryable?: unknown })?.retryable)
        throw new AutomationActionError(err instanceof Error ? err.message : String(err), {
          retryable,
          cause: err,
        })
      }
    },
    async preview({ ctx, config }) {
      if (!manifest.preview || !context) {
        return { summary: `Would run ${manifest.label.en}`, wouldRun: true }
      }
      const hook = await context(ctx.storeId, pluginId)
      const summary = await manifest.preview(hook, {
        stepRunId: ctx.stepKey,
        subject: ctx.subject,
        config,
        data: ctx.data,
      })
      return { summary, wouldRun: true }
    },
  }
}

/**
 * The resolver the interpreter and dry run take. Pieces are resolved per call against the
 * store's install state, so an uninstalled app's action stops resolving at once.
 */
export function actionResolver(opts: {
  plugins: readonly PluginManifest[]
  /** Builds a plugin's hook context (the worker's `storeAppContext`); null where none (API). */
  pluginContext?: ((storeId: string, pluginId: string) => Promise<AppHookContext>) | null
}) {
  return async (tx: StoreTx, storeId: string, id: string): Promise<ResolvedAction | null> => {
    const pieces = await storePieces(tx, storeId, opts.plugins)
    const descriptor = pieces.catalogue.action(id)
    if (!descriptor) return null
    if (descriptor.pluginId) {
      const manifest = pluginAction(pieces.plugins, id)
      return manifest
        ? { descriptor, executor: pluginExecutor(manifest, opts.pluginContext ?? null) }
        : null
    }
    const executor = actionExecutor(id)
    return executor ? { descriptor, executor } : null
  }
}
