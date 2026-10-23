/** SOURCE OF TRUTH: built-in automation executors — WHAT: registers the server half of every built-in action (`builtin-actions.ts`) under its catalogue id, with the host deps the message and HTTP actions need / WHY: the interpreter finds executors only through the registry; one call per process (worker, API) wires them all, and a missing executor fails this module's test, not a run. */
import { BUILTIN_ACTION_IDS } from '../builtin-actions'
import type { ActionExecutor } from '../executor'
import { registerActionExecutor } from '../registry'
import { httpExecutors } from './http'
import { messageExecutors } from './messages'
import { orderExecutors } from './order'
import { orderUpdate } from './order-update'
import { recordExecutors } from './records'
import type { BuiltinActionDeps } from './shared'
import { tagExecutors } from './tags'

/** Every built-in executor, one per `BUILTIN_ACTION_IDS` entry. */
export function builtinExecutors(deps: BuiltinActionDeps): ActionExecutor[] {
  return [
    ...tagExecutors(),
    ...orderExecutors(),
    ...recordExecutors(),
    ...messageExecutors(deps),
    orderUpdate(deps) as unknown as ActionExecutor,
    ...httpExecutors(deps),
  ] as unknown as ActionExecutor[]
}

let registered = false

/** Registers every built-in executor once per process (the worker and the API call it). */
export function registerBuiltinActions(deps: BuiltinActionDeps): void {
  if (registered) return
  registered = true
  for (const executor of builtinExecutors(deps)) registerActionExecutor(executor)
}

/** Ids with no executor; empty when the catalogue and `actions/**` agree (asserted in tests). */
export const missingBuiltinExecutors = (deps: BuiltinActionDeps): string[] => {
  const have = new Set(builtinExecutors(deps).map((e) => e.id))
  return BUILTIN_ACTION_IDS.filter((id) => !have.has(id))
}

export type { BuiltinActionDeps } from './shared'
