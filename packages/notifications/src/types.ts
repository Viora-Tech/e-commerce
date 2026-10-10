/**
 * The notification contract. Channels (email, WhatsApp, SMS) implement it; the
 * worker renders a template and hands the result to every channel a store has
 * enabled. Channels never touch the database or the order.
 */

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
  | 'draft_invoice'
  | 'checkout_recovery'
  /** A copy of an order document (invoice, credit note) sent on request, with the file attached. */
  | 'document_copy'
  /** Storefront account sign-in code. Sent straight away, never queued: it lives ten minutes. */
  | 'login_code'
  /** Confirms a shopper's own account deletion. Sent straight away, like `login_code`. Email only; phone channels send `login_code`. */
  | 'account_deletion_code'
  /** A one-time sign-in link (magic link) for a storefront shopper. Email only, sent straight away. */
  | 'login_link'
  /** Confirm a newsletter signup (double opt-in); `actionUrl` is the confirm page. Email only. */
  | 'newsletter_confirm'
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
  /** To the MERCHANT: a shopper sent a message from a contact or advice form (Forms app). Email only. */
  | 'contact_message'
  /** Asks the shopper to review what a delivered order brought (Reviews app). Email only. */
  | 'review_request'
  /** The one reminder when no review came after a review request (Reviews app). Email only. */
  | 'review_reminder'
  /** The store replied to the shopper's review (Reviews app). Email only. */
  | 'review_reply'
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
  /**
   * PLATFORM message, not a store one: someone was invited to help run a store. Sent through the
   * platform email account straight away; `actionUrl` is the accept link. Email only.
   */
  | 'staff_invite'

export type Recipient = {
  email?: string | undefined
  /** E.164 without the plus, e.g. 919876543210. */
  phone?: string | undefined
  name?: string | undefined
}

/** One parcel of an order that ships from several warehouses, for "Ships in 2 parcels". */
export type EmailParcel = {
  /** "New Delhi, Delhi" */
  from: string
  items: { title: string; quantity: number }[]
  /** "Tue, 18 Aug - Thu, 20 Aug"; null when no estimate was worked out. */
  dateRange: string | null
  /** Pre-order items that ship once they arrive. */
  onHold: boolean
}

/** Everything a template needs; built by the worker from the order row. */
export type TemplateData = {
  storeName: string
  /** Absent for messages about a cart that is not an order yet. */
  orderNumber?: number | undefined
  customerName: string
  totalLabel: string
  lines: { title: string; quantity: number; priceLabel: string; imageUrl?: string | undefined }[]
  /** GST split shown above the total, e.g. CGST/SGST or IGST rows. Omit to show only the total. */
  taxBreakdown?: { label: string; amount: string }[] | undefined
  /**
   * An order shipped from more than one warehouse: each parcel's origin, items and expected
   * dates ("Ships in 2 parcels"). Omitted for an order that ships in one.
   */
  parcels?: EmailParcel[] | undefined
  paymentMethodLabel: string
  /** Printed in the footer under the store name, when the store has set one. */
  storeAddress?: string | undefined
  /** Set on order_shipped when the carrier gave us one. */
  trackingUrl?: string | undefined
  /** Courier tracking number, printed so the shopper can quote it. */
  waybill?: string | undefined
  /** Where the shopper can see the order (thank-you page). */
  orderUrl?: string | undefined
  /** Pay link on a draft invoice, or the restore link on an abandoned cart. */
  actionUrl?: string | undefined
  /** For document_copy: what is attached, e.g. "tax invoice INV/25-26/0007". */
  documentLabel?: string | undefined
  /** Extra links installed apps add, e.g. "Download invoice". */
  links?: { label: string; url: string }[] | undefined
  /** For delivery_failed: what the courier's latest scan said went wrong, if known. */
  deliveryIssue?: { reasonLabel?: string | undefined } | undefined
  /** For refund_issued: how much went back, by what method, and roughly when it lands. */
  refund?:
    | {
        amountLabel: string
        methodLabel: string
        /** e.g. "5 to 7 business days"; omitted when the method is immediate (gift card). */
        etaLabel?: string | undefined
      }
    | undefined
  /** For balance messages: what is still owed, what was paid up front, and when it must be paid by. */
  balance?:
    | {
        dueLabel: string
        depositLabel: string
        payByLabel?: string | undefined
        /** Shown when the store keeps the deposit if the balance is never paid. */
        depositNonRefundable?: boolean | undefined
      }
    | undefined
  /** For unpaid_cancel_notice: when the order will be cancelled. */
  deadlineLabel?: string | undefined
  /** For login_code: the one-time code. */
  code?: string | undefined
  /** For back_in_stock_confirm/back_in_stock_alert: the product/variant and the links each carries. */
  backInStock?:
    | {
        productTitle: string
        variantTitle?: string | undefined
        /** Confirm-signup link (back_in_stock_confirm only). */
        confirmUrl?: string | undefined
        /** Where to buy it now (back_in_stock_alert). */
        productUrl?: string | undefined
        /** Stop future alerts for this signup; carried on every message. */
        unsubscribeUrl: string
      }
    | undefined
  /** For return_* messages: the return itself. `lines` then lists the items going back. */
  returnInfo?:
    | {
        /** e.g. "R-12". */
        label: string
        reasonLabel?: string | undefined
        /** The merchant's reason for declining (return_rejected). */
        decisionNote?: string | undefined
        /** How the parcel comes back (return_approved): the courier collects, or the shopper sends it. */
        pickup?: 'courier' | 'customer' | undefined
        /** Return tracking number when a courier collects. */
        pickupWaybill?: string | undefined
        /** Amount and where it went (return_refunded). */
        refundLabel?: string | undefined
        refundMethod?: 'original' | 'store_credit' | undefined
      }
    | undefined
  /**
   * For review_request / review_reminder: the products to review, each with its own link, the
   * merchant's subject and the stop-these-emails link. For review_reply: the product and reply.
   */
  review?:
    | {
        items?: { title: string; url: string; imageUrl?: string | undefined }[] | undefined
        /** The merchant's subject, product name already filled in. */
        subject?: string | undefined
        unsubscribeUrl?: string | undefined
        productTitle?: string | undefined
        productUrl?: string | undefined
        reply?: string | undefined
      }
    | undefined
  /** For contact_message: who wrote and what they said. */
  contactMessage?:
    | { name: string; email: string; phone: string; text: string; path: string }
    | undefined
  /** For staff_invite: who sent it, the role offered and the platform's own name (PLATFORM_EMAIL_NAME). */
  staffInvite?:
    | {
        inviterEmail: string
        roleLabel?: string | undefined
        platformName: string
      }
    | undefined
  /** For gift_card_issued: the code in full (the only place it is ever shown) and its terms. */
  giftCard?:
    | {
        code: string
        balanceLabel: string
        expiresLabel?: string | undefined
        message?: string | undefined
      }
    | undefined
}

/** A file sent with an email. Channels that cannot carry files ignore it. */
export type Attachment = {
  filename: string
  contentType: string
  content: Uint8Array
}

export type Message = {
  to: Recipient
  template: TemplateId
  data: TemplateData
  attachments?: Attachment[] | undefined
}

export type SendResult = { ok: true; providerRef: string } | { ok: false; error: string }

/**
 * A marketing send: an email the platform already rendered (campaigns,
 * automations), or an approved WhatsApp template by name. Unlike `Message`
 * the channel does no templating of its own.
 */
export type MarketingSend =
  | {
      kind: 'email'
      to: Recipient
      subject: string
      html: string
      text: string
      /** Extra headers, e.g. List-Unsubscribe and List-Unsubscribe-Post. */
      headers?: { name: string; value: string }[] | undefined
    }
  | {
      kind: 'whatsapp_template'
      to: Recipient
      template: { name: string; language: string; variables: string[] }
    }

/** An approved message template, as the provider reports it (WhatsApp). */
export type ChannelTemplate = {
  name: string
  language: string
  /** MARKETING, UTILITY or AUTHENTICATION on WhatsApp. */
  category: string
  status: string
  /** Body text with {{1}}-style placeholders, for the picker's preview. */
  body: string
  variableCount: number
}

export type NotificationChannel = {
  /** Stable id used in store settings and the notification table. Lowercase, no spaces. */
  readonly id: string
  readonly label: string
  /** Which recipient field this channel needs; the worker skips it when the order has none. */
  readonly requires: 'email' | 'phone'
  /**
   * Phone channels only: how the message travels. Absent means WhatsApp, the
   * only phone channel before SMS apps existed. Sign-in codes by SMS need a
   * channel that says `sms`.
   */
  readonly medium?: 'sms' | 'whatsapp'
  /** Never throws: transport errors come back as `{ ok: false }` so the worker can retry. */
  send(message: Message): Promise<SendResult>
  /** Marketing sends; channels without it cannot carry campaigns or automations. Never throws. */
  sendMarketing?(message: MarketingSend): Promise<SendResult>
  /** Approved templates the channel may send (WhatsApp). Throws on transport errors. */
  listTemplates?(): Promise<ChannelTemplate[]>
}

/** Same shape as the payments ProviderField; copied so this package stays dependency-free. */
export type ProviderField = {
  key: string
  label: string
  /** Encrypted at rest and masked in the UI. */
  secret?: boolean
  required?: boolean
  multiline?: boolean
  /** `boolean` renders a checkbox and stores 'true' | 'false'. Defaults to text. */
  type?: 'text' | 'boolean'
  help?: string
}

export type NotificationChannelFactory<Config> = {
  id: string
  label: string
  /** What the merchant fills in Settings > Notifications. Drives the form. */
  fields: ProviderField[]
  validateConfig(raw: unknown): { ok: true; config: Config } | { ok: false; errors: string[] }
  create(config: Config): NotificationChannel
}
