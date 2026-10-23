/** SOURCE OF TRUTH: built-in automation executors — WHAT: registers the server half of every built-in action under its catalogue id / WHY: the interpreter finds executors only through the registry; one line per action here, one file per action beside it. */
import { registerActionExecutor } from '../registry'
import { addOrderTags } from './order-tags'

let registered = false

/** What the host passes the executors (the actions work widens this; all optional). */
export type ActionHost = { settingsSecret?: string | undefined; storefrontUrl?: string | undefined }

/** Registers every built-in executor once per process (the worker and the API call it). */
export function registerBuiltinActions(_host: ActionHost = {}): void {
  if (registered) return
  registered = true
  registerActionExecutor(addOrderTags)
}
