/** SOURCE OF TRUTH: automation conditions entry — WHAT: the condition evaluator and subject loaders the interpreter and the dry run call (`evaluateRules`, `loadSubjectData`) / WHY: one seam between the engine and the field catalogue; the conditions work fills these bodies without touching the interpreter. Server-only (loaders read the database). */
import type { ConditionEvaluator, SubjectLoader } from '../executor'

/**
 * Evaluates a rule group over subject data. STUB until the conditions work lands: holds only
 * for an empty group, so nothing branches by accident.
 */
export const evaluateRules: ConditionEvaluator = (rules) => ({
  pass: rules.rules.length === 0,
  trace: [],
})

/**
 * Loads `{ order: {...} }` / `{ customer: {...} }` / `{ product: {...} }` keyed by the paths in
 * `condition-fields.ts`; null when the record is gone. STUB until the conditions work lands:
 * an empty object, so runs proceed and merge tags render empty.
 */
export const loadSubjectData: SubjectLoader = async () => ({})
