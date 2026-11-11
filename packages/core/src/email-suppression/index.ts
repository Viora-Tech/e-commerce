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
  emailSuppressionsFor,
  listEmailSuppressions,
  recordEmailFeedback,
  SOFT_BOUNCE_LIMIT,
  SOFT_BOUNCE_WINDOW_DAYS,
} from './service'
export { parseSesFeedback, type SesFeedback } from './ses-feedback'
export { handleSesSnsWebhook, type SesWebhookDeps, type SesWebhookOutcome } from './webhook'
