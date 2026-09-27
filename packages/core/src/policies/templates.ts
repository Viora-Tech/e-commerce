/** SOURCE OF TRUTH: policy templates — WHAT: the India-specific starting text for each store policy, filled from store details, returns settings and shipping zones, as rich text (Lexical JSON) / WHY: "Create from template" in Settings → Policies and its tests must produce the same wording; merchants edit the result, so a template is a starting point, not legal advice */
import { formatMoney } from '@commerce/money'
import type { ReturnRefundMethod } from '../returns/policy'
import type { StoreAddress } from '../settings/general'
import { INDIAN_STATE_NAMES } from '../tax/states'
import type { GrievanceOfficer, PolicyType } from './client'

/*
 * Pure. Wording follows the Consumer Protection (E-Commerce) Rules, 2020 (seller
 * details, grievance officer, return and refund terms, delivery terms) and the
 * Digital Personal Data Protection Act, 2023 (notice, purposes, consent and its
 * withdrawal, the rights of the data principal, grievance redressal, the Data
 * Protection Board). No em or en dashes: shoppers read this text.
 */

export type PolicyTemplateInput = {
  storeName: string
  /** Registered business name; the store name when blank. */
  legalName: string
  address: StoreAddress
  email: string
  phone: string
  gstin: string
  /** Storefront address shoppers know, e.g. "waimers.in"; blank when there is none yet. */
  website: string
  returns: { enabled: boolean; windowDays: number; refundMethod: ReturnRefundMethod }
  shipping: {
    /** Fastest and slowest delivery, in days, across the store's rates (or its defaults). */
    minDays: number
    maxDays: number
    codAllowed: boolean
    /** Lowest order value that ships free, if any rate offers it. */
    freeAbovePaise: number | null
  }
  grievanceOfficer: GrievanceOfficer
}

/** Details a template needed but did not have; the admin asks for them before creating. */
export type MissingDetail =
  | 'address'
  | 'email'
  | 'phone'
  | 'grievanceOfficerName'
  | 'grievanceOfficerContact'

/** Working days within which an approved refund is sent back. */
const REFUND_DAYS = 7
/** Complaints are acknowledged within 48 hours and resolved within a month (E-Commerce Rules 2020). */
const ACKNOWLEDGE_HOURS = 48
const RESOLVE_DAYS = 30

const blank = (field: string) => `[${field}]`

function oneLineAddress(a: StoreAddress): string {
  const state = INDIAN_STATE_NAMES[a.state.trim().toUpperCase()] ?? a.state.trim()
  const cityLine = [a.city, state]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ')
  const parts = [a.line1, a.line2, cityLine && a.pincode ? `${cityLine} ${a.pincode}` : cityLine]
  return parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

/** What the templates will print in brackets because it is not filled in yet. */
export function missingTemplateDetails(input: PolicyTemplateInput): MissingDetail[] {
  const out: MissingDetail[] = []
  if (!input.address.line1.trim() || !input.address.city.trim()) out.push('address')
  if (!input.email.trim()) out.push('email')
  if (!input.phone.trim()) out.push('phone')
  if (!input.grievanceOfficer.name.trim()) out.push('grievanceOfficerName')
  if (!input.grievanceOfficer.email.trim() && !input.grievanceOfficer.phone.trim()) {
    out.push('grievanceOfficerContact')
  }
  return out
}

/** Lexical JSON, the shape `@commerce/richtext` renders and the admin editor loads. */
export type PolicyNode = { type: string; children?: PolicyNode[]; [key: string]: unknown }
export type PolicyRichText = { root: PolicyNode }

type Block = { h: string } | { p: string } | { ul: string[] }

const text = (t: string): PolicyNode => ({
  type: 'text',
  text: t,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

const element = (type: string, children: PolicyNode[], extra: Record<string, unknown> = {}) =>
  ({
    type,
    format: '',
    indent: 0,
    version: 1,
    direction: null,
    children,
    ...extra,
  }) satisfies PolicyNode

function toNode(block: Block): PolicyNode {
  if ('h' in block) return element('heading', [text(block.h)], { tag: 'h2' })
  if ('p' in block) {
    return element('paragraph', [text(block.p)], { textFormat: 0, textStyle: '' })
  }
  return element(
    'list',
    block.ul.map((item, i) => element('listitem', [text(item)], { value: i + 1 })),
    { listType: 'bullet', start: 1, tag: 'ul' },
  )
}

function toRichText(blocks: Block[]): PolicyRichText {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: null,
      children: blocks.map(toNode),
    },
  }
}

/** Shared values, with a bracketed prompt where a detail is missing. */
function facts(input: PolicyTemplateInput) {
  const g = input.grievanceOfficer
  const address = oneLineAddress(input.address)
  return {
    store: input.storeName.trim() || blank('store name'),
    legal: input.legalName.trim() || input.storeName.trim() || blank('business name'),
    address: address || blank('business address'),
    email: input.email.trim() || blank('email address'),
    phone: input.phone.trim() || blank('phone number'),
    gstin: input.gstin.trim(),
    website: input.website.trim(),
    officer: g.name.trim() || blank('grievance officer name'),
    officerDesignation: g.designation.trim(),
    officerEmail: g.email.trim() || input.email.trim() || blank('grievance officer email'),
    officerPhone: g.phone.trim() || input.phone.trim() || blank('grievance officer phone'),
  }
}

type Facts = ReturnType<typeof facts>

function sellerDetails(f: Facts): string[] {
  return [
    `Business name: ${f.legal}`,
    `Address: ${f.address}`,
    `Email: ${f.email}`,
    `Phone: ${f.phone}`,
    ...(f.gstin ? [`GSTIN: ${f.gstin}`] : []),
    ...(f.website ? [`Website: ${f.website}`] : []),
  ]
}

function grievanceBlocks(f: Facts): Block[] {
  return [
    { h: 'Grievance officer' },
    {
      p: `If you have a complaint, write to our grievance officer. We acknowledge every complaint within ${ACKNOWLEDGE_HOURS} hours and resolve it within ${RESOLVE_DAYS} days of receiving it.`,
    },
    {
      ul: [
        `Name: ${f.officer}`,
        ...(f.officerDesignation ? [`Designation: ${f.officerDesignation}`] : []),
        `Email: ${f.officerEmail}`,
        `Phone: ${f.officerPhone}`,
        `Address: ${f.address}`,
      ],
    },
  ]
}

function days(n: number): string {
  return n === 1 ? '1 day' : `${n} days`
}

function deliveryWindow(input: PolicyTemplateInput): string {
  const { minDays, maxDays } = input.shipping
  return minDays === maxDays ? days(maxDays) : `${minDays} to ${maxDays} days`
}

function refundBlocks(input: PolicyTemplateInput, f: Facts): Block[] {
  const r = input.returns
  const refundTo =
    r.refundMethod === 'store_credit'
      ? 'as store credit you can spend on your next order, or to your original payment method if you ask for it'
      : 'to your original payment method. Cash on delivery orders are refunded by bank transfer or UPI to an account you give us'
  const returns: Block[] = r.enabled
    ? [
        { h: 'Returns' },
        {
          p: `You can ask for a return within ${days(r.windowDays)} of delivery from your account, or by writing to ${f.email}. Items must be unused, with their original tags and packaging.`,
        },
        { p: 'We do not accept returns of:' },
        {
          ul: [
            'Gift cards',
            'Items marked as not returnable on the product page',
            'Items damaged after delivery through misuse',
          ],
        },
      ]
    : [
        { h: 'Returns' },
        {
          p: `We do not take returns for a change of mind. You can still return an item that is defective, damaged, wrong, or not as described: write to ${f.email} within 7 days of delivery.`,
        },
      ]
  return [
    { p: `This policy explains how returns, exchanges and refunds work at ${f.store}.` },
    ...returns,
    { h: 'Damaged, defective or wrong items' },
    {
      p: 'If an item arrives damaged, defective, different from what you ordered, or not as described, or reaches you later than the delivery date we promised, we will take it back and replace it or refund you in full, including shipping. Please share a photo or short video of the item and its packaging so we can sort it out quickly.',
    },
    { h: 'Refunds' },
    {
      p: `Once we receive and check the returned item, we approve the refund and send it within ${REFUND_DAYS} working days, ${refundTo}. Your bank may take a few more days to show it.`,
    },
    { h: 'Cancellations' },
    {
      p: 'You can cancel an order at no cost until it is shipped. Prepaid orders cancelled this way are refunded in full.',
    },
    { h: 'Seller details' },
    { ul: sellerDetails(f) },
    ...grievanceBlocks(f),
  ]
}

function shippingBlocks(input: PolicyTemplateInput, f: Facts): Block[] {
  const s = input.shipping
  const free = s.freeAbovePaise
    ? [
        {
          p: `Shipping is free on orders of ${formatMoney(s.freeAbovePaise)} or more. For other orders, the shipping charge is shown at checkout before you pay.`,
        },
      ]
    : [{ p: 'The shipping charge, if any, is shown at checkout before you pay.' }]
  return [
    { p: `This policy explains how ${f.store} delivers your orders.` },
    { h: 'Where we deliver' },
    {
      p: 'We deliver across India through trusted courier partners. Enter your PIN code at checkout to see whether we deliver there and when your order should arrive.',
    },
    { h: 'Delivery time' },
    {
      p: `Orders are usually delivered in ${deliveryWindow(input)} after they are shipped. Orders placed on Sundays or public holidays are shipped on the next working day. Remote areas can take longer.`,
    },
    { h: 'Shipping charges' },
    ...free,
    ...(s.codAllowed
      ? [
          { h: 'Cash on delivery' },
          {
            p: 'Cash on delivery is available on most PIN codes. Any cash on delivery fee is shown at checkout before you place the order.',
          },
        ]
      : []),
    { h: 'Tracking' },
    {
      p: 'Once your order ships, we send you a tracking link by email or WhatsApp. You can also see its status in your account.',
    },
    { h: 'Late or lost parcels' },
    {
      p: `If your order has not arrived by the expected date, write to ${f.email} or call ${f.phone}. If a parcel is lost in transit we will send a replacement or refund you in full.`,
    },
    { h: 'Seller details' },
    { ul: sellerDetails(f) },
  ]
}

function privacyBlocks(f: Facts): Block[] {
  return [
    {
      p: `${f.legal} ("we", "us") runs ${f.store}. This notice explains what personal data we collect, why, and the rights you have under the Digital Personal Data Protection Act, 2023. We are the Data Fiduciary for the personal data you share with us.`,
    },
    { h: 'What we collect' },
    {
      ul: [
        'Your name, email address, mobile number and delivery address',
        'Your GSTIN and business name, if you enter them for a GST invoice',
        'Your orders, returns and messages to us',
        'Payment status from our payment partners. We never see or store your full card number, UPI PIN or banking password',
        'Basic device and browsing data, and cookies, as described below',
      ],
    },
    { h: 'Why we use it' },
    {
      ul: [
        'To take, deliver, and support your orders, returns and refunds',
        'To send order updates by email, SMS or WhatsApp',
        'To issue GST invoices and keep the records Indian tax law requires',
        'To prevent fraud and keep our store secure',
        'To send offers, only if you agree to them. You can stop them at any time',
      ],
    },
    { h: 'Consent' },
    {
      p: 'We use your personal data for the purposes above with your consent, or where the law allows it without consent, such as to complete an order you asked for. You can withdraw your consent at any time by writing to our grievance officer. Withdrawing it does not affect what was done before, but we may not be able to take new orders from you without the data an order needs.',
    },
    { h: 'Who we share it with' },
    {
      p: 'We share only what is needed, with: courier partners, to deliver your order; payment gateways, to take your payment; email, SMS and WhatsApp providers, to send you updates; and our hosting and software providers, who process data on our behalf. We do not sell your personal data. We may share data when the law requires it.',
    },
    { h: 'How long we keep it' },
    {
      p: 'We keep your personal data while your account is active or while we need it for the purposes above. Order and invoice records are kept for as long as Indian tax and accounting laws require. After that we erase it.',
    },
    { h: 'Your rights' },
    {
      ul: [
        'Ask for a summary of the personal data we hold about you and who we shared it with',
        'Ask us to correct, complete, update or erase your personal data',
        'Withdraw your consent',
        'Nominate someone to exercise these rights for you in case of death or incapacity',
        'Raise a grievance with us, and if you are not satisfied with our answer, complain to the Data Protection Board of India',
      ],
    },
    { p: 'To use any of these rights, write to our grievance officer below.' },
    { h: 'Children' },
    {
      p: 'Our store is meant for people aged 18 and over. We do not knowingly collect personal data from children without verifiable consent from a parent or guardian.',
    },
    { h: 'Cookies' },
    {
      p: 'We use cookies that the store needs to work, such as your cart. Analytics and marketing cookies load only if you allow them in the cookie banner, and you can change your choice at any time.',
    },
    { h: 'Security' },
    {
      p: 'We protect your personal data with reasonable security safeguards, including encryption in transit. If a breach affects your data, we will tell you and the Data Protection Board as the law requires.',
    },
    ...grievanceBlocks(f),
    { h: 'Changes to this notice' },
    { p: 'If we change this notice, we will update it on this page with the new date.' },
  ]
}

function termsBlocks(input: PolicyTemplateInput, f: Facts): Block[] {
  return [
    {
      p: `These terms apply when you browse or buy from ${f.store}, run by ${f.legal}. By placing an order you agree to them.`,
    },
    { h: 'Orders' },
    {
      p: 'An order is confirmed when we send you an order confirmation. We may cancel an order if an item is out of stock, a price was shown wrongly, or we suspect fraud. If we cancel a prepaid order, we refund you in full.',
    },
    { h: 'Prices and payment' },
    {
      p: `All prices are in Indian rupees and include GST. The total you pay, including any shipping${input.shipping.codAllowed ? ' or cash on delivery fee' : ''}, is shown at checkout before you pay.`,
    },
    { h: 'Delivery' },
    {
      p: `We deliver across India, usually in ${deliveryWindow(input)} after shipping. See our shipping policy for details.`,
    },
    { h: 'Returns and refunds' },
    {
      p: input.returns.enabled
        ? `You can ask for a return within ${days(input.returns.windowDays)} of delivery. See our refund and returns policy for details.`
        : 'See our refund and returns policy for what can be returned and how refunds work.',
    },
    { h: 'Product information' },
    {
      p: 'We describe our products as accurately as we can. Colours may look slightly different on your screen. If an item is not as described, you can return it.',
    },
    { h: 'Your account' },
    {
      p: 'Keep your login details to yourself. Tell us straight away if you think someone else has used your account.',
    },
    { h: 'Use of the store' },
    {
      p: 'Do not misuse the store, for example by placing fake orders, copying its content, or trying to break its security.',
    },
    { h: 'Liability' },
    {
      p: 'Nothing in these terms limits your rights as a consumer under the Consumer Protection Act, 2019. Apart from those rights, our liability for an order is limited to the amount you paid for it.',
    },
    { h: 'Governing law' },
    {
      p: 'These terms are governed by the laws of India. Courts at the place of our registered address have jurisdiction, without affecting your right to approach a consumer commission.',
    },
    { h: 'Seller details' },
    { ul: sellerDetails(f) },
    ...grievanceBlocks(f),
  ]
}

function contactBlocks(f: Facts): Block[] {
  return [
    { p: `We are happy to help with your order. You can reach ${f.store} here:` },
    { ul: sellerDetails(f) },
    ...grievanceBlocks(f),
  ]
}

/** The template for one policy, filled in, as rich text ready for the editor. */
export function fillPolicyTemplate(type: PolicyType, input: PolicyTemplateInput): PolicyRichText {
  const f = facts(input)
  switch (type) {
    case 'refund-policy':
      return toRichText(refundBlocks(input, f))
    case 'privacy-policy':
      return toRichText(privacyBlocks(f))
    case 'terms-of-service':
      return toRichText(termsBlocks(input, f))
    case 'shipping-policy':
      return toRichText(shippingBlocks(input, f))
    case 'contact-information':
      return toRichText(contactBlocks(f))
  }
}
