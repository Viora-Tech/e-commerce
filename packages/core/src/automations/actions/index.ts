/** SOURCE OF TRUTH: automation actions entry — WHAT: re-exports the built-in executor registration (`register-builtins.ts`) and the helpers other engine code may need / WHY: the worker and API import one path, `@commerce/core/automations/server` re-exports it. */

export { HTTP_SIGNING_SECRET_HANDLE, httpSigningKey, signRequest } from './http'
export { isOrderUpdateTemplate } from './messages'
export {
  type BuiltinActionDeps,
  builtinExecutors,
  missingBuiltinExecutors,
  registerBuiltinActions,
} from './register-builtins'
