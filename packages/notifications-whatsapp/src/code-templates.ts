/** SOURCE OF TRUTH: one-time code messages on WhatsApp — WHAT: the templates Meta treats as AUTHENTICATION / WHY: a leaf module both whatsapp.ts and template-specs.ts read at load time, so neither waits on the other's import cycle. */
import type { TemplateId } from '@commerce/notifications'

/**
 * Messages that carry a one-time code. Meta sends these as AUTHENTICATION templates: the body takes
 * only the code, the copy-code button takes it again, and Meta writes the wording itself
 * ("{{1}} is your verification code"), so they are submitted by hand.
 */
export const CODE_TEMPLATES: ReadonlySet<TemplateId> = new Set<TemplateId>([
  'login_code',
  'account_deletion_code',
  'email_change_code',
])
