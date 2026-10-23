/** SOURCE OF TRUTH: automation conditions entry — WHAT: the condition evaluator and subject loader the interpreter and the dry run call (`evaluateRules`, `loadSubjectData`) / WHY: one seam between the engine and the field catalogue; `evaluate.ts` and `loaders.ts` hold the bodies. Server-only (the loader reads the database). */
import type { ConditionEvaluator, SubjectLoader } from '../executor'
import { evaluateRulesAt } from './evaluate'
import { loadSubject } from './loaders'

/** Evaluates a rule group over subject data, now, in the store's time zone (`data.store`). */
export const evaluateRules: ConditionEvaluator = (rules, data) => evaluateRulesAt(rules, data)

/** Loads `{ order }` / `{ customer }` / `{ product }` / `{ cart }` plus `store`; null when gone. */
export const loadSubjectData: SubjectLoader = loadSubject

export { DEFAULT_TIME_ZONE, type EvaluateOptions, evaluateRulesAt, readPath } from './evaluate'
export { customerIdOf } from './loaders'
