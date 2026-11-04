import type { Fields } from '@puckeditor/core'
import { isValidElement, type ReactNode } from 'react'
import { mainProductContent as copy } from '../data/zero-drift/main-product'
import { inlineRichtext, inlineText } from './inline-fields'

/**
 * SOURCE OF TRUTH KEYWORDS: MainProductSettings, mainProductSettings, product buy box settings
 * WHAT:  The settings of the `MainProduct` dynamic section (the product page's gallery and
 *        buy box), their Customize fields, and the one parser both renderers use.
 * WHY:   The theme's main-product section is a list of blocks; ours keeps it as toggles and
 *        text fields on the one section (no nested blocks), in the theme's block order. The
 *        storefront route and the admin canvas both hand the raw saved settings to
 *        `mainProductSettings`, so a missing or legacy value (old docs saved only
 *        `showEmiHint`/`showDeliveryEstimate`) reads as its default in both places. On an
 *        imported theme our extras default off instead (`./imported-defaults.ts`, #1049).
 * WHERE: Fields registered in `./dynamic.tsx`; drawn by `../components/product-view.tsx`.
 */

/** Copy a merchant can type on the canvas: a string, or Puck's inline editor node. */
type Copy = ReactNode

/** `metafieldKey` fills the body from the product's own field (`custom.<key>`) when it has one. */
export type MainProductAccordion = { title: Copy; body: Copy; metafieldKey: string }
export type MainProductBadge = { icon: string; label: Copy }

export type MainProductSettings = {
  /** Our extras (off on an imported theme, `./imported-defaults.ts`): the EMI line under the price. */
  showEmiHint: boolean
  /** "Inclusive of all taxes" under the price. */
  showTaxNote: boolean
  /** "Save ₹N" beside the struck-through MRP. */
  showSaving: boolean
  /** The offer note reads "₹X with UPI" at the store's UPI / bank transfer discount. */
  showUpiPrice: boolean
  /** The dispatch line (`deliveryText`) above the PIN code check. */
  showDispatchLine: boolean
  /** The PIN code delivery check under the buy buttons. */
  showDeliveryEstimate: boolean
  galleryLayout: 'rail' | 'stacked'
  lensZoom: boolean
  showVendor: boolean
  showRating: boolean
  /** No reviews yet: empty stars and "Be the first to review", as an imported theme draws them. */
  showRatingInvite: boolean
  /** The Pre-order pill beside the title. */
  showPreorderBadge: boolean
  ratingValue: number
  ratingCount: number
  showPaymentSignals: boolean
  paymentNote: Copy
  upiPercent: number
  offerHeading: string
  offerBody: string
  offerSupportLabel: string
  offerSupportUrl: string
  showStockBar: boolean
  stockThreshold: number
  showPreorderLink: boolean
  preorderLinkUrl: string
  deliveryText: Copy
  showSpecs: boolean
  /** Spec cells, one per line: `Label | field key | icon`, `## Group` for a group label. */
  specFields: string
  /** The Specification panel's table when the product has no written spec: `field key | Label`. */
  specRows: string
  showDescription: boolean
  showAccordions: boolean
  accordions: MainProductAccordion[]
  /** Shipping and Returns panels from the store's published policies, below the accordions. */
  showPolicyPanels: boolean
  showTrustBadges: boolean
  trustBadges: MainProductBadge[]
  trustWhatsappLabel: Copy
  showAssurance: boolean
  assuranceReturns: Copy
  assuranceReturnsPreorder: Copy
  assuranceCod: Copy
  assuranceWhatsappLabel: Copy
  showReturnsLine: boolean
  showWhatsappAsk: boolean
  whatsappAskLabel: Copy
  whatsappNumber: string
  whatsappMessage: string
  showShare: boolean
  shareLabel: Copy
  /** The title and option names in capitals, as the imported theme sets its headings. */
  uppercaseTitle: boolean
  /** `outline`: Figma's outline button beside the quantity. `solid`: the theme's filled one. */
  addToCartStyle: 'outline' | 'solid'
  trustBadgesLayout: 'chips' | 'grid'
}

const f = copy.fields

/** A Show / Hide radio (also used by the other dynamic sections in `./dynamic.tsx`). */
export const showHide = (label: string) =>
  ({
    type: 'radio',
    label,
    options: [
      { label: 'Show', value: true },
      { label: 'Hide', value: false },
    ],
  }) as const

/** The section's Customize fields, in the theme's block order. */
export const mainProductFields: Fields = {
  showEmiHint: showHide(f.showEmiHint),
  showTaxNote: showHide(f.showTaxNote),
  showSaving: showHide(f.showSaving),
  showDeliveryEstimate: showHide(f.showDeliveryEstimate),
  galleryLayout: { type: 'select', label: f.galleryLayout, options: copy.galleryLayouts },
  lensZoom: showHide(f.lensZoom),
  showVendor: showHide(f.showVendor),
  showRating: showHide(f.showRating),
  showRatingInvite: showHide(f.showRatingInvite),
  showPreorderBadge: showHide(f.showPreorderBadge),
  ratingValue: { type: 'number', label: f.ratingValue, min: 0, max: 5, step: 0.1 },
  ratingCount: { type: 'number', label: f.ratingCount, min: 0 },
  showPaymentSignals: showHide(f.showPaymentSignals),
  paymentNote: inlineText(f.paymentNote),
  showUpiPrice: showHide(f.showUpiPrice),
  upiPercent: { type: 'number', label: f.upiPercent, min: 0, max: 50 },
  offerHeading: { type: 'text', label: f.offerHeading },
  offerBody: { type: 'richtext', label: f.offerBody },
  offerSupportLabel: { type: 'text', label: f.offerSupportLabel },
  offerSupportUrl: { type: 'text', label: f.offerSupportUrl },
  showStockBar: showHide(f.showStockBar),
  stockThreshold: { type: 'number', label: f.stockThreshold, min: 1, max: 100 },
  showPreorderLink: showHide(f.showPreorderLink),
  preorderLinkUrl: { type: 'text', label: f.preorderLinkUrl },
  showDispatchLine: showHide(f.showDispatchLine),
  deliveryText: inlineText(f.deliveryText),
  showSpecs: showHide(f.showSpecs),
  specFields: { type: 'textarea', label: f.specFields },
  specRows: { type: 'textarea', label: f.specRows },
  showDescription: showHide(f.showDescription),
  showAccordions: showHide(f.showAccordions),
  showPolicyPanels: showHide(f.showPolicyPanels),
  accordions: {
    type: 'array',
    label: f.accordions,
    max: 6,
    getItemSummary: (item: { title?: unknown }) =>
      typeof item.title === 'string' && item.title ? item.title : f.accordionTitle,
    defaultItemProps: { ...copy.newAccordion },
    arrayFields: {
      title: inlineText(f.accordionTitle),
      body: inlineRichtext(f.accordionBody),
      metafieldKey: { type: 'text', label: f.accordionMetafieldKey },
    },
  },
  showTrustBadges: showHide(f.showTrustBadges),
  trustBadges: {
    type: 'array',
    label: f.trustBadges,
    max: 5,
    getItemSummary: (item: { label?: unknown }) =>
      typeof item.label === 'string' && item.label ? item.label : f.badgeLabel,
    defaultItemProps: { ...copy.newBadge },
    arrayFields: {
      icon: { type: 'select', label: f.badgeIcon, options: copy.badgeIcons },
      label: inlineText(f.badgeLabel),
    },
  },
  trustWhatsappLabel: inlineText(f.trustWhatsappLabel),
  showAssurance: showHide(f.showAssurance),
  assuranceReturns: inlineText(f.assuranceReturns),
  assuranceReturnsPreorder: inlineText(f.assuranceReturnsPreorder),
  assuranceCod: inlineText(f.assuranceCod),
  assuranceWhatsappLabel: inlineText(f.assuranceWhatsappLabel),
  showReturnsLine: showHide(f.showReturnsLine),
  showWhatsappAsk: showHide(f.showWhatsappAsk),
  whatsappAskLabel: inlineText(f.whatsappAskLabel),
  whatsappNumber: { type: 'text', label: f.whatsappNumber },
  whatsappMessage: { type: 'text', label: f.whatsappMessage },
  showShare: showHide(f.showShare),
  shareLabel: inlineText(f.shareLabel),
  uppercaseTitle: { type: 'radio', label: f.uppercaseTitle, options: copy.titleCases },
  addToCartStyle: { type: 'select', label: f.addToCartStyle, options: copy.addToCartStyles },
  trustBadgesLayout: {
    type: 'select',
    label: f.trustBadgesLayout,
    options: copy.trustBadgesLayouts,
  },
}

const d = copy.defaults

/** Saved defaults: plain JSON, arrays copied so an edit never mutates the module constant. */
export const mainProductDefaults = (): Record<string, unknown> => ({
  ...d,
  accordions: d.accordions.map((a) => ({ ...a })),
  trustBadges: d.trustBadges.map((b) => ({ ...b })),
})

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)
const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
const str = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback)
/** Inline copy: the saved string, or the React node Puck hands over while editing. */
const text = (value: unknown, fallback: string): Copy =>
  typeof value === 'string' || isValidElement(value) ? value : fallback

const items = (value: unknown): Record<string, unknown>[] | null =>
  Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
    : null

/** Saved (or partial, or legacy) settings → the full, typed set ProductView draws. */
export function mainProductSettings(raw: Record<string, unknown> = {}): MainProductSettings {
  const accordions = items(raw.accordions)
  const badges = items(raw.trustBadges)
  return {
    showEmiHint: bool(raw.showEmiHint, d.showEmiHint),
    showTaxNote: bool(raw.showTaxNote, d.showTaxNote),
    showSaving: bool(raw.showSaving, d.showSaving),
    showUpiPrice: bool(raw.showUpiPrice, d.showUpiPrice),
    showDispatchLine: bool(raw.showDispatchLine, d.showDispatchLine),
    showDeliveryEstimate: bool(raw.showDeliveryEstimate, d.showDeliveryEstimate),
    galleryLayout: raw.galleryLayout === 'stacked' ? 'stacked' : 'rail',
    lensZoom: bool(raw.lensZoom, d.lensZoom),
    showVendor: bool(raw.showVendor, d.showVendor),
    showRating: bool(raw.showRating, d.showRating),
    showRatingInvite: bool(raw.showRatingInvite, d.showRatingInvite),
    showPreorderBadge: bool(raw.showPreorderBadge, d.showPreorderBadge),
    ratingValue: Math.min(5, Math.max(0, num(raw.ratingValue, d.ratingValue))),
    ratingCount: Math.max(0, Math.round(num(raw.ratingCount, d.ratingCount))),
    showPaymentSignals: bool(raw.showPaymentSignals, d.showPaymentSignals),
    paymentNote: text(raw.paymentNote, d.paymentNote),
    upiPercent: Math.min(50, Math.max(0, num(raw.upiPercent, d.upiPercent))),
    offerHeading: str(raw.offerHeading, d.offerHeading),
    offerBody: str(raw.offerBody, d.offerBody),
    offerSupportLabel: str(raw.offerSupportLabel, d.offerSupportLabel),
    offerSupportUrl: str(raw.offerSupportUrl, d.offerSupportUrl),
    showStockBar: bool(raw.showStockBar, d.showStockBar),
    stockThreshold: Math.max(1, num(raw.stockThreshold, d.stockThreshold)),
    showPreorderLink: bool(raw.showPreorderLink, d.showPreorderLink),
    preorderLinkUrl: str(raw.preorderLinkUrl, d.preorderLinkUrl),
    deliveryText: text(raw.deliveryText, d.deliveryText),
    showSpecs: bool(raw.showSpecs, d.showSpecs),
    specFields: str(raw.specFields, d.specFields),
    specRows: str(raw.specRows, d.specRows),
    showDescription: bool(raw.showDescription, d.showDescription),
    showAccordions: bool(raw.showAccordions, d.showAccordions),
    showPolicyPanels: bool(raw.showPolicyPanels, d.showPolicyPanels),
    accordions: (accordions ?? d.accordions).map((a) => ({
      title: text(a.title, ''),
      body: text(a.body, ''),
      metafieldKey: str(a.metafieldKey, '').trim(),
    })),
    showTrustBadges: bool(raw.showTrustBadges, d.showTrustBadges),
    trustBadges: (badges ?? d.trustBadges).map((b) => ({
      icon: str(b.icon, 'check'),
      label: text(b.label, ''),
    })),
    trustWhatsappLabel: text(raw.trustWhatsappLabel, d.trustWhatsappLabel),
    showAssurance: bool(raw.showAssurance, d.showAssurance),
    assuranceReturns: text(raw.assuranceReturns, d.assuranceReturns),
    assuranceReturnsPreorder: text(raw.assuranceReturnsPreorder, d.assuranceReturnsPreorder),
    assuranceCod: text(raw.assuranceCod, d.assuranceCod),
    assuranceWhatsappLabel: text(raw.assuranceWhatsappLabel, d.assuranceWhatsappLabel),
    showReturnsLine: bool(raw.showReturnsLine, d.showReturnsLine),
    showWhatsappAsk: bool(raw.showWhatsappAsk, d.showWhatsappAsk),
    whatsappAskLabel: text(raw.whatsappAskLabel, d.whatsappAskLabel),
    whatsappNumber: str(raw.whatsappNumber, d.whatsappNumber),
    whatsappMessage: str(raw.whatsappMessage, d.whatsappMessage),
    showShare: bool(raw.showShare, d.showShare),
    shareLabel: text(raw.shareLabel, d.shareLabel),
    uppercaseTitle: bool(raw.uppercaseTitle, d.uppercaseTitle),
    addToCartStyle: raw.addToCartStyle === 'solid' ? 'solid' : 'outline',
    trustBadgesLayout: raw.trustBadgesLayout === 'grid' ? 'grid' : 'chips',
  }
}

/** Copy that is present: a node from the editor, or a non-blank string. */
export const hasCopy = (value: Copy): boolean =>
  typeof value === 'string' ? value.trim() !== '' : value != null && value !== false

/** A wa.me link with the message filled in, or null when no number is set. */
export function whatsappHref(
  number: string,
  message: string,
  productTitle: string,
  pageUrl: string,
): string | null {
  const digits = number.replace(/\D/g, '')
  if (!digits) return null
  const textParam = `${message.replaceAll('[product]', productTitle)} ${pageUrl}`.trim()
  return `https://wa.me/${digits}?text=${encodeURIComponent(textParam)}`
}
