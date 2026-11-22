import type { TemplateId } from '../types'

/**
 * Templates the platform sends about itself (through the platform email account), never a store's
 * own customer messages. They are not in Settings → Notifications and a merchant cannot switch them off.
 */
export const PLATFORM_TEMPLATE_IDS: readonly TemplateId[] = [
  'staff_invite',
  'email_change_code',
  'email_changed',
  'plan_bill',
  'bug_report_update',
]

/** Team alerts and platform mail: a plainer email with no store menu or help block. */
export const INTERNAL: ReadonlySet<TemplateId> = new Set<TemplateId>([
  'staff_new_order',
  'staff_daily_summary',
  'staff_weekly_report',
  'staff_monthly_report',
  'staff_seo_weekly',
  'contact_message',
  'question_asked',
  'affiliate_application',
  'unpaid_cancel_notice',
  'purchase_order',
  ...PLATFORM_TEMPLATE_IDS,
])

/** The team reports render through their own layout when the report data is there. */
export const REPORTS: ReadonlySet<TemplateId> = new Set<TemplateId>([
  'staff_daily_summary',
  'staff_weekly_report',
  'staff_monthly_report',
])

/**
 * Emails a merchant can redesign in Settings → Notifications → Edit design: every store email
 * except the platform's own mail and the team reports, which have their own layout.
 */
export function designableTemplate(template: TemplateId): boolean {
  return !REPORTS.has(template) && !(PLATFORM_TEMPLATE_IDS as readonly string[]).includes(template)
}
