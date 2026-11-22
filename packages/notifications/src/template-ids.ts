/** Every message the platform can send, one id per template (see `templates/index.ts`). */
export type TemplateId =
  | 'order_placed'
  | 'payment_received'
  | 'order_shipped'
  /** The courier has it out for delivery today. */
  | 'out_for_delivery'
  /** The order was delivered (courier tracking, or the merchant marked it by hand). */
  | 'delivered'
  /** A delivery attempt failed (NDR); says what the shopper can do about it. */
  | 'delivery_failed'
  /** An order was cancelled, outside the dedicated unpaid-transfer message. */
  | 'order_cancelled'
  /** Money went back on an order, outside a return's own refund message. */
  | 'refund_issued'
  /** Staff edited a placed order and its items or total changed; lists the order as it is now. */
  | 'order_edited'
  /**
   * An online payment failed or was never finished (the shopper closed the gateway): one nudge
   * a short while after checkout, with the link to retry the payment. Never once it is paid.
   */
  | 'payment_pending'
  /** A shipment's tracking number or courier changed after the shopper was told it shipped. */
  | 'shipping_update'
  /** Staff sent the shopper the link to their order's status page ("Send order link"). */
  | 'order_link'
  /** Staff shipped part of the order now; the rest follows in its own parcel ("ships in 2 parts"). */
  | 'order_split'
  /** Staff asked a cash on delivery shopper to pay online instead, with their order page link ("Ask to pay online"). */
  | 'cod_pay_online'
  | 'draft_invoice'
  | 'checkout_recovery'
  /** A copy of an order document (invoice, credit note) sent on request, with the file attached. */
  | 'document_copy'
  /** A plain email the merchant writes to one customer from the customer page (`custom` subject and message). Email only. */
  | 'customer_message'
  /** Storefront account sign-in code. Sent straight away, never queued: it lives ten minutes. */
  | 'login_code'
  /** Confirms a shopper's own account deletion. Sent straight away, like `login_code`. Email only; phone channels send `login_code`. */
  | 'account_deletion_code'
  /** A one-time sign-in link (magic link) for a storefront shopper. Email only, sent straight away. */
  | 'login_link'
  /** Confirm a newsletter signup (double opt-in); `actionUrl` is the confirm page. Email only. */
  | 'newsletter_confirm'
  /**
   * A new newsletter subscriber's welcome code (Figma batch 8 "Welcome coupon"): the code, what
   * it is worth and a few popular products. Email only. Rendered and previewed here; the
   * Automations app's welcome flow still sends its own email until it switches to this one.
   */
  | 'welcome_coupon'
  /** A gift card was issued (bought or sent by the merchant); carries the code. Email only. */
  | 'gift_card_issued'
  /** A deposit pre-order's balance is due; carries the pay-balance link. */
  | 'balance_request'
  /** The same, again, while the balance is still unpaid. */
  | 'balance_reminder'
  /** The balance was paid; the order will ship. */
  | 'balance_received'
  /** A manual UPI / bank transfer order is still unpaid; links to the payment details. Sent by the merchant. */
  | 'payment_reminder'
  | 'transfer_requested'
  /** To the MERCHANT: a shopper sent a message from a contact or advice form (Forms app). Email only. */
  | 'contact_message'
  /** Asks the shopper to review what a delivered order brought (Reviews app). Email, WhatsApp or both (app setting). */
  | 'review_request'
  /** The one reminder when no review came after a review request (Reviews app). Same channels. */
  | 'review_reminder'
  /** The store replied to the shopper's review (Reviews app). Email only. */
  | 'review_reply'
  /** Thanks for a published photo review, with a one-time discount code (Reviews app). Email only. */
  | 'review_reward'
  /** To the ASKER: the store answered their product question and it is live (Reviews app). Email only. */
  | 'question_answered'
  /** To the MERCHANT: a shopper asked a product question (Reviews app); `actionUrl` opens Questions. Email only. */
  | 'question_asked'
  /** To the MERCHANT: someone applied to the affiliate program and waits for approval. Email only. */
  | 'affiliate_application'
  /** To an AFFILIATE (Affiliates app): approved, a new sale, or a payout sent. Email, and WhatsApp with an approved template. */
  | 'affiliate_update'
  /** To the MERCHANT: an unpaid transfer order will be cancelled automatically. Email only. */
  | 'unpaid_cancel_notice'
  /** A manual UPI / bank transfer order was cancelled for non-payment. */
  | 'unpaid_cancelled'
  /** Confirm a back-in-stock "notify me" signup (double opt-in). */
  | 'back_in_stock_confirm'
  /** The variant the shopper asked about is available again. */
  | 'back_in_stock_alert'
  /** We got the shopper's return request. */
  | 'return_requested'
  /** The return was accepted; says how the parcel comes back. */
  | 'return_approved'
  /** The return was declined, with the merchant's reason. */
  | 'return_rejected'
  /** The returned parcel reached the store. */
  | 'return_received'
  /** Money went back for the return (original payment or store credit). */
  | 'return_refunded'
  /** The exchange for a return became an order and will ship; `lines` are the new items. */
  | 'return_exchanged'
  /**
   * COD & RTO app: asks a cash on delivery shopper to confirm (or cancel) the order; `actionUrl`
   * is the confirm page. By WhatsApp when the store has it, email otherwise.
   */
  | 'cod_confirm'
  /**
   * PLATFORM message, not a store one: someone was invited to help run a store. Sent through the
   * platform email account straight away; `actionUrl` is the accept link. Email only.
   */
  | 'staff_invite'
  /**
   * To a TEAM MEMBER who turned on new-order alerts (Account → Notifications): an order came
   * in. `actionUrl` opens it in the admin. Email or WhatsApp.
   */
  | 'staff_new_order'
  /**
   * To a TEAM MEMBER who turned on the daily summary: the day's orders, sales and what waits
   * to be shipped (`dailySummary`). `actionUrl` opens the admin. Email or WhatsApp.
   */
  | 'staff_daily_summary'
  /** To a TEAM MEMBER who turned on the weekly or monthly report: the period's `report`. Email only. */
  | 'staff_weekly_report'
  | 'staff_monthly_report'
  /**
   * To the store OWNER while Google Search Console is connected: the week's SEO moves and the
   * top suggestions (`seoWeekly`). `actionUrl` opens Online store › SEO. Email only.
   */
  | 'staff_seo_weekly'
  /**
   * PLATFORM message: the code that confirms a member's NEW sign-in email (Account → Sign-in &
   * security → Change email). Sent to the new address; `code` is the one-time code. Email only.
   */
  | 'email_change_code'
  /**
   * PLATFORM message: tells the OLD address that the member's sign-in email was changed, so a
   * change they did not make does not go unnoticed. `emailChange.newEmail` is masked. Email only.
   */
  | 'email_changed'
  /**
   * PLATFORM message to a store owner: a plan or paid-app bill to pay (a new bill, a renewal, or
   * one now overdue). `planBill` says what for; `actionUrl` is the pay link. Email only.
   */
  | 'plan_bill'
  /**
   * PLATFORM message to a TEAM MEMBER who filed a bug report ("Report a bug"): the team fixed it
   * (it ships in the next update) or the fix is live. `bugReport` says which; `actionUrl` opens
   * Account → My reports. Sent on the channels the member keeps on under "Your bug reports"
   * (Account → Notifications; email on by default): email from the platform account, WhatsApp
   * through the store's WhatsApp channel.
   */
  | 'bug_report_update'
  /**
   * To a SUPPLIER: the store's purchase order, with the PDF attached. Sent from the admin's
   * "Email to supplier" through the store's own sender email. Email only.
   */
  | 'purchase_order'
