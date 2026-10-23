/** SOURCE OF TRUTH: built-in automation executors — WHAT: registers the server half of every built-in action under its catalogue id / WHY: the interpreter finds executors only through the registry; one line per action family here, one file per resource beside it. */
import { BUILTIN_ACTION_IDS } from '../builtin-actions'
import type { ActionExecutor } from '../executor'
import { registerActionExecutor } from '../registry'
import { httpExecutors } from './http'
import { marketingExecutors } from './marketing'
import { messageExecutors } from './messages'
import { orderExecutors } from './order'
import { orderUpdate } from './order-update'
import { recordExecutors } from './records'
import { type ActionHost, type DepsFor, depsResolver } from './shared'
import { tagExecutors } from './tags'

/** Every built-in executor, one per `BUILTIN_ACTION_IDS` entry. */
export function builtinExecutors(depsFor: DepsFor): ActionExecutor[] {
  return [
    // Tags on orders, customers and products.
    ...tagExecutors(),
    // Order note, hold, release, fulfil, cancel.
    ...orderExecutors(),
    // Metafields and manual collections.
    ...recordExecutors(),
    // Staff alerts by email and WhatsApp.
    ...messageExecutors(depsFor),
    // Growth's consent-gated marketing email and WhatsApp.
    ...marketingExecutors(depsFor),
    // Order updates to the shopper (no consent, order templates only).
    orderUpdate(depsFor),
    // Signed HTTP request (SSRF-guarded).
    ...httpExecutors(depsFor),
  ] as unknown as ActionExecutor[]
}

let registered = false

/**
 * Registers every built-in executor once per process (the worker and the API call it). The
 * worker passes its settings secret and storefront URL; without them the env is read.
 */
export function registerBuiltinActions(host: ActionHost = {}): void {
  if (registered) return
  registered = true
  for (const executor of builtinExecutors(depsResolver(host))) registerActionExecutor(executor)
}

/** Ids with no executor; empty when the catalogue and `actions/**` agree (asserted in tests). */
export const missingBuiltinExecutors = (): string[] => {
  const have = new Set(builtinExecutors(depsResolver()).map((e) => e.id))
  return BUILTIN_ACTION_IDS.filter((id) => !have.has(id))
}

export { HTTP_SIGNING_SECRET_HANDLE, httpSigningKey, signRequest } from './http'
export { isOrderUpdateTemplate } from './order-update'
export type { ActionHost, BuiltinActionDeps } from './shared'
