import { storeAppContext } from '@commerce/core'
import {
  AUTOMATION_STEP_QUEUE,
  AUTOMATION_TICK_QUEUE,
  AUTOMATION_TRIGGER_QUEUE,
  type AutomationStepJob,
  type AutomationTriggerJob,
  actionResolver,
  type EngineDeps,
  evaluateRules,
  loadSubjectData,
  registerBuiltinActions,
  runStepJob,
  runTickJob,
  runTriggerJob,
} from '@commerce/core/automations/server'
import { getRegistries } from '@commerce/core/registries'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import {
  fairProcessor,
  type IORedis,
  KEEP_FINISHED,
  type MediaProcessQueue,
  QUEUE_LIMITS,
  Queue,
  Worker,
} from '@commerce/queue'
import { appDeps } from './app-events'

/** How often due waits, retries, lost runs, approvals and schedules are picked up. */
export const AUTOMATIONS_TICK_MS = 30_000

type Opts = {
  settingsSecret: string
  storefrontUrl: string
  mediaProcess?: MediaProcessQueue | undefined
}

/**
 * The Automations engine on three queues (design §8.5). The outbox relay queues one trigger job
 * per row a trigger listens to; it starts runs and queues each run's step job. A step job walks
 * its run node by node (each node its own transaction) until it waits, asks or ends; a wait or a
 * retry queues the next generation delayed. A 30 s tick re-queues anything due from the
 * database, so a Redis loss only delays runs. Trigger and step jobs share out per store
 * (`fairProcessor`), so one store's flood never slows the rest.
 */
export function createAutomationsWorker(connection: IORedis, db: Db, opts: Opts) {
  registerBuiltinActions({ settingsSecret: opts.settingsSecret, storefrontUrl: opts.storefrontUrl })
  const log = (message: string) => logger.info(message, { area: 'automations' })
  const apps = appDeps(db, opts)
  const plugins = getRegistries().plugins
  const deps: EngineDeps = {
    evaluate: evaluateRules,
    loadSubject: loadSubjectData,
    resolveAction: actionResolver({
      plugins,
      pluginContext: (storeId, pluginId) =>
        storeAppContext(apps, storeId, `automation:${pluginId}`),
    }),
    log,
  }

  const triggerQueue = new Queue<AutomationTriggerJob>(AUTOMATION_TRIGGER_QUEUE, { connection })
  const stepQueue = new Queue<AutomationStepJob>(AUTOMATION_STEP_QUEUE, { connection })
  const tickQueue = new Queue(AUTOMATION_TICK_QUEUE, { connection })

  const trigger = new Worker<AutomationTriggerJob>(
    AUTOMATION_TRIGGER_QUEUE,
    fairProcessor(connection, AUTOMATION_TRIGGER_QUEUE, QUEUE_LIMITS.automationsTrigger, (job) =>
      runTriggerJob(db, job.data, stepQueue, log),
    ),
    { connection, concurrency: QUEUE_LIMITS.automationsTrigger.concurrency, ...KEEP_FINISHED },
  )

  const step = new Worker<AutomationStepJob>(
    AUTOMATION_STEP_QUEUE,
    fairProcessor(connection, AUTOMATION_STEP_QUEUE, QUEUE_LIMITS.automationsStep, async (job) => {
      const r = await runStepJob(db, job.data, deps, stepQueue)
      return { nodes: r.nodes, parked: r.parked?.status ?? 'done' }
    }),
    { connection, concurrency: QUEUE_LIMITS.automationsStep.concurrency, ...KEEP_FINISHED },
  )

  const tick = new Worker(AUTOMATION_TICK_QUEUE, () => runTickJob(db, stepQueue, log), {
    connection,
    ...KEEP_FINISHED,
  })

  return { trigger, step, tick, triggerQueue, stepQueue, tickQueue }
}
