/** SOURCE OF TRUTH: email-suppression barrel — WHAT: what core exports for SES bounce and complaint handling (webhook, list, guard) / WHY: the worker, API and channel builder import one place */
export {
  SUPPRESSED_PREFIX,
  suppressedError,
  withSuppressionGuard,
} from './guard'
export {
  activeSuppressions,
  allowEmailAgain,
  type EmailSuppressionRow,
  emailSuppressionFor,
  listEmailSuppressions,
  recordEmailFeedback,
  SOFT_BOUNCE_LIMIT,
  SOFT_BOUNCE_WINDOW_DAYS,
} from './service'
export { parseSesFeedback, type SesFeedback } from './ses-feedback'
export { handleSesSnsWebhook, type SesWebhookDeps, type SesWebhookOutcome } from './webhook'
