import type { TemplateData, TemplateId } from '../types'
import { sharedContent as shared } from './content'

/** The one button a message carries (its main call to action), or none without a link. */
export function primaryActionFor(
  template: TemplateId,
  d: TemplateData,
): { label: string; url: string } | undefined {
  switch (template) {
    case 'order_placed':
    case 'payment_received':
      return d.orderUrl ? { label: shared.viewOrder, url: d.orderUrl } : undefined
    case 'order_shipped':
    case 'out_for_delivery':
      return d.trackingUrl
        ? { label: 'Track your order', url: d.trackingUrl }
        : d.orderUrl
          ? { label: shared.viewOrder, url: d.orderUrl }
          : undefined
    case 'delivered':
    case 'order_cancelled':
    case 'refund_issued':
      return d.orderUrl ? { label: shared.viewOrder, url: d.orderUrl } : undefined
    case 'delivery_failed':
      return d.trackingUrl
        ? { label: 'Track your order', url: d.trackingUrl }
        : d.orderUrl
          ? { label: shared.viewOrder, url: d.orderUrl }
          : undefined
    case 'shipping_update':
      return d.trackingUrl
        ? { label: 'Track your order', url: d.trackingUrl }
        : d.orderUrl
          ? { label: shared.viewOrder, url: d.orderUrl }
          : undefined
    case 'payment_pending':
      return d.orderUrl ? { label: 'Retry payment', url: d.orderUrl } : undefined
    case 'cod_pay_online':
      return d.orderUrl ? { label: 'Pay online', url: d.orderUrl } : undefined
    case 'draft_invoice':
      return d.actionUrl ? { label: 'Pay securely', url: d.actionUrl } : undefined
    case 'checkout_recovery':
      return d.actionUrl ? { label: 'Finish checkout', url: d.actionUrl } : undefined
    case 'cod_confirm':
      return d.actionUrl ? { label: 'Confirm or cancel my order', url: d.actionUrl } : undefined
    case 'login_link':
      return d.actionUrl ? { label: `Sign in to ${d.storeName}`, url: d.actionUrl } : undefined
    case 'welcome_coupon':
      return d.actionUrl ? { label: 'Start shopping', url: d.actionUrl } : undefined
    case 'newsletter_confirm':
      return d.actionUrl ? { label: 'Confirm my email', url: d.actionUrl } : undefined
    case 'staff_invite':
      return d.actionUrl ? { label: 'Accept invitation', url: d.actionUrl } : undefined
    case 'plan_bill':
      return d.actionUrl ? { label: 'Pay now', url: d.actionUrl } : undefined
    case 'bug_report_update':
      return d.actionUrl ? { label: 'See my reports', url: d.actionUrl } : undefined
    case 'staff_new_order':
      return d.actionUrl ? { label: 'Open the order', url: d.actionUrl } : undefined
    case 'staff_daily_summary':
      return d.actionUrl ? { label: 'Open your admin', url: d.actionUrl } : undefined
    case 'staff_seo_weekly':
      return d.actionUrl ? { label: 'See search opportunities', url: d.actionUrl } : undefined
    case 'document_copy':
      return d.links?.[0] ? { label: d.links[0].label, url: d.links[0].url } : undefined
    case 'balance_request':
    case 'balance_reminder':
      return d.actionUrl ? { label: 'Pay the balance', url: d.actionUrl } : undefined
    case 'payment_reminder':
    case 'transfer_requested':
      return d.orderUrl ? { label: 'View payment details', url: d.orderUrl } : undefined
    case 'back_in_stock_confirm':
      return d.backInStock?.confirmUrl
        ? { label: 'Confirm alert', url: d.backInStock.confirmUrl }
        : undefined
    case 'review_request':
    case 'review_reminder': {
      const first = d.review?.items?.[0]
      return first ? { label: 'Write a review', url: first.url } : undefined
    }
    case 'affiliate_update':
      return d.affiliate?.portalUrl
        ? { label: 'Open your dashboard', url: d.affiliate.portalUrl }
        : undefined
    case 'review_reply':
      return d.review?.productUrl ? { label: 'See the reply', url: d.review.productUrl } : undefined
    case 'review_reward':
      return d.actionUrl ? { label: 'Shop with your code', url: d.actionUrl } : undefined
    case 'question_answered':
      return d.review?.productUrl
        ? { label: 'See it on the product page', url: d.review.productUrl }
        : undefined
    case 'question_asked':
      return d.actionUrl ? { label: 'Answer the question', url: d.actionUrl } : undefined
    case 'back_in_stock_alert':
      return d.backInStock?.productUrl
        ? { label: 'Shop now', url: d.backInStock.productUrl }
        : undefined
    default:
      return d.orderUrl ? { label: shared.viewOrder, url: d.orderUrl } : undefined
  }
}
