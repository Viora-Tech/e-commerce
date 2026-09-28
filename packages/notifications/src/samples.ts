import type { TemplateData, TemplateId } from './types'

/** Sample order used by the conformance suite, the dev preview and the admin's message preview. */
export const sampleTemplateData: TemplateData = {
  storeName: 'Waimers',
  orderNumber: 42,
  customerName: 'Asha',
  totalLabel: '₹2,048',
  lines: [
    {
      title: 'Maboroshi mousepad',
      quantity: 1,
      priceLabel: '₹1,999',
      imageUrl: 'https://placehold.co/80x80/f2f2f2/141414?text=%20',
    },
  ],
  taxBreakdown: [
    { label: 'CGST (9%)', amount: '₹22' },
    { label: 'SGST (9%)', amount: '₹27' },
  ],
  paymentMethodLabel: 'Cash on delivery',
  storeAddress: '221 MG Road, Bengaluru 560001',
}

const base = sampleTemplateData

/** One representative TemplateData per TemplateId, for /dev/emails and Settings → Notifications → Preview. */
export const sampleTemplateDataByTemplate: Record<TemplateId, TemplateData> = {
  order_placed: { ...base, orderUrl: 'https://waimers.example/orders/42' },
  payment_received: { ...base, orderUrl: 'https://waimers.example/orders/42' },
  order_shipped: {
    ...base,
    waybill: 'AWB123456789',
    trackingUrl: 'https://waimers.example/track/42',
  },
  out_for_delivery: {
    ...base,
    waybill: 'AWB123456789',
    trackingUrl: 'https://waimers.example/track/42',
  },
  delivered: { ...base, orderUrl: 'https://waimers.example/account/orders/42' },
  delivery_failed: {
    ...base,
    trackingUrl: 'https://waimers.example/track/42',
    deliveryIssue: { reasonLabel: 'Consignee not available' },
  },
  order_cancelled: { ...base, orderUrl: 'https://waimers.example/account/orders/42' },
  refund_issued: {
    ...base,
    orderUrl: 'https://waimers.example/account/orders/42',
    refund: {
      amountLabel: '₹1,999',
      methodLabel: 'Original payment method',
      etaLabel: '5 to 7 working days',
    },
  },
  draft_invoice: { ...base, actionUrl: 'https://waimers.example/pay/42' },
  checkout_recovery: {
    ...base,
    orderNumber: undefined,
    actionUrl: 'https://waimers.example/cart/restore/abc',
  },
  document_copy: {
    ...base,
    documentLabel: 'tax invoice INV/25-26/0007',
    links: [{ label: 'Download tax invoice', url: 'https://waimers.example/docs/inv-7.pdf' }],
  },
  login_code: {
    ...base,
    orderNumber: undefined,
    lines: [],
    taxBreakdown: undefined,
    totalLabel: '',
    code: '482913',
  },
  account_deletion_code: {
    ...base,
    orderNumber: undefined,
    lines: [],
    taxBreakdown: undefined,
    totalLabel: '',
    code: '730155',
  },
  login_link: {
    ...base,
    orderNumber: undefined,
    lines: [],
    taxBreakdown: undefined,
    totalLabel: '',
    actionUrl: 'https://waimers.example/account/login/link?token=sample',
  },
  gift_card_issued: {
    ...base,
    orderNumber: undefined,
    lines: [],
    taxBreakdown: undefined,
    giftCard: {
      code: 'WAIM-GIFT-2048',
      balanceLabel: '₹2,000',
      expiresLabel: '31 Mar 2027',
      message: 'Happy birthday Asha, enjoy!',
    },
  },
  balance_request: {
    ...base,
    actionUrl: 'https://waimers.example/pay-balance/42',
    balance: { dueLabel: '₹1,200', depositLabel: '₹848', payByLabel: '10 Oct 2026' },
  },
  balance_reminder: {
    ...base,
    actionUrl: 'https://waimers.example/pay-balance/42',
    balance: {
      dueLabel: '₹1,200',
      depositLabel: '₹848',
      payByLabel: '10 Oct 2026',
      depositNonRefundable: true,
    },
  },
  balance_received: { ...base, orderUrl: 'https://waimers.example/orders/42' },
  payment_reminder: { ...base, orderUrl: 'https://waimers.example/orders/42/pay' },
  unpaid_cancel_notice: { ...base, deadlineLabel: '28 Sep 2026' },
  unpaid_cancelled: { ...base },
  back_in_stock_confirm: {
    ...base,
    orderNumber: undefined,
    lines: [],
    taxBreakdown: undefined,
    backInStock: {
      productTitle: 'Maboroshi mousepad',
      variantTitle: 'Large',
      confirmUrl: 'https://waimers.example/back-in-stock/confirm/abc',
      unsubscribeUrl: 'https://waimers.example/back-in-stock/unsubscribe/abc',
    },
  },
  back_in_stock_alert: {
    ...base,
    orderNumber: undefined,
    lines: [],
    taxBreakdown: undefined,
    backInStock: {
      productTitle: 'Maboroshi mousepad',
      variantTitle: 'Large',
      productUrl: 'https://waimers.example/products/maboroshi-mousepad',
      unsubscribeUrl: 'https://waimers.example/back-in-stock/unsubscribe/abc',
    },
  },
  return_requested: {
    ...base,
    taxBreakdown: undefined,
    orderUrl: 'https://waimers.example/account/orders/42',
    returnInfo: { label: 'R-3', reasonLabel: 'It arrived damaged or broken' },
  },
  return_approved: {
    ...base,
    taxBreakdown: undefined,
    orderUrl: 'https://waimers.example/account/orders/42',
    returnInfo: { label: 'R-3', pickup: 'courier', pickupWaybill: 'RVP123456789' },
  },
  return_rejected: {
    ...base,
    taxBreakdown: undefined,
    orderUrl: 'https://waimers.example/account/orders/42',
    returnInfo: {
      label: 'R-3',
      decisionNote: 'The mousepad has been used and cannot be sold again.',
    },
  },
  return_received: {
    ...base,
    taxBreakdown: undefined,
    orderUrl: 'https://waimers.example/account/orders/42',
    returnInfo: { label: 'R-3' },
  },
  return_refunded: {
    ...base,
    taxBreakdown: undefined,
    orderUrl: 'https://waimers.example/account/orders/42',
    returnInfo: { label: 'R-3', refundLabel: '₹1,999', refundMethod: 'original' },
  },
}
