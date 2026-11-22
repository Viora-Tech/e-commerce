import type { TemplateData, TemplateId } from '../types'

/**
 * The line in the grey footer that says why this address got the email (Figma "Emails"
 * batches: "You get this email because you placed an order at Waimers."). One per kind of
 * message; a template not listed here is about an order.
 */
type Reason = (store: string, d: TemplateData) => string

const order: Reason = (s) => `You get this email because you placed an order at ${s}.`
const usedAddress: Reason = (s) =>
  `You get this email because someone used this email address at ${s}.`
const returned: Reason = (s) =>
  `You get this email because you asked to return an item from your ${s} order.`
const shopper: Reason = (s) => `You get this email because you shop at ${s}.`
const team: Reason = (s) => `You get this because you are on the ${s} team.`

const REASONS: Partial<Record<TemplateId, Reason>> = {
  login_code: (s) =>
    `You get this email because someone asked to sign in to ${s} with this address.`,
  login_link: (s) =>
    `You get this email because someone asked to sign in to ${s} with this address.`,
  account_deletion_code: usedAddress,
  email_change_code: usedAddress,
  email_changed: usedAddress,
  newsletter_confirm: (s) =>
    `You get this email because this address was entered on the ${s} newsletter form.`,
  welcome_coupon: (s) =>
    `You get this email because you joined the ${s} newsletter. Unsubscribe any time.`,
  gift_card_issued: (s) => `You get this email because someone sent you a ${s} gift card.`,
  checkout_recovery: (s) =>
    `You get this email because you started a checkout at ${s}. Stop these reminders any time.`,
  back_in_stock_confirm: (s) =>
    `You get this email because this address asked for a stock alert at ${s}.`,
  back_in_stock_alert: () =>
    'You get this email because you asked us to tell you when this was back.',
  review_request: shopper,
  review_reminder: shopper,
  review_reply: shopper,
  review_reward: shopper,
  question_answered: shopper,
  customer_message: shopper,
  affiliate_update: (s) => `You get this email because you joined the ${s} affiliate program.`,
  return_requested: returned,
  return_approved: returned,
  return_rejected: returned,
  return_received: returned,
  return_refunded: returned,
  return_exchanged: returned,
  staff_new_order: team,
  staff_daily_summary: team,
  staff_seo_weekly: (s) =>
    `You get this because you own ${s} and Google Search Console is connected. Turn it off in Settings → Notifications.`,
  contact_message: team,
  question_asked: team,
  affiliate_application: team,
  unpaid_cancel_notice: team,
  purchase_order: (s) => `Sent by ${s} to its supplier.`,
  staff_invite: () => 'You get this email because someone invited this address to a store team.',
  plan_bill: (s, d) =>
    `You get this email because you own the ${s} store${d.planBill?.platformName ? ` on ${d.planBill.platformName}` : ''}.`,
  bug_report_update: () => 'You get this email because you reported a bug in your admin.',
}

/** Why this address got the email, for the footer. */
export function footerReason(template: TemplateId, d: TemplateData): string {
  return (REASONS[template] ?? order)(d.storeName, d)
}
