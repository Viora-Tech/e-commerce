/** SOURCE OF TRUTH: the theme's product section → our MainProduct settings — WHAT: reads an imported theme's `main-product` section (its blocks in order and their settings) into the `MainProduct` section's settings: rating, UPI offer note, stock bar, spec cells, trust badges, assurance, accordions (merchant text or a product metafield), returns line, WhatsApp, share, description / WHY: on import our MainProduct replaces the theme's main section (checkout runs on ours), and without this it opened with our defaults, so the buy box lost everything the merchant had set up in the theme */

import type { ShopifyTemplateBlock, ShopifyTemplateSection } from './schema'

type Props = Record<string, unknown>

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
      ? Number(v)
      : null

/** A theme richtext/inline value as one line of plain text (our inline fields are plain). */
export function plainText(v: unknown): string {
  return str(v)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** App blocks (`shopify://apps/…`) that drew the product's star rating. */
const RATING_APP = /preview_badge|star_rating|rating/i

/** The blocks that say a section is a product section we can read (not some other "main"). */
const BUY_BOX_BLOCKS = new Set(['title', 'price', 'buy_buttons', 'variant_picker'])

/** The block's settings, or nothing for a disabled block (a hidden block is not shown). */
function blocksOf(section: ShopifyTemplateSection): { type: string; s: Props }[] {
  const order = section.block_order ?? Object.keys(section.blocks ?? {})
  return order.flatMap((id) => {
    const b: ShopifyTemplateBlock | undefined = section.blocks?.[id]
    return b && !b.disabled ? [{ type: b.type, s: b.settings ?? {} }] : []
  })
}

/** WhatsApp number and message: the first block that sets them wins (they share one in ours). */
function whatsapp(out: Props, number: unknown, message: unknown) {
  const digits = str(number).replace(/\D/g, '')
  if (digits && !out.whatsappNumber) out.whatsappNumber = digits
  const text = plainText(message)
  if (text && !out.whatsappMessage) out.whatsappMessage = text
}

/**
 * `MainProduct` settings for a theme's product section. Blocks the theme had switch the
 * matching part on with the theme's copy; parts the theme's buy box never showed (stars,
 * share, description, vendor) switch off, so the page reads as it did on Shopify. A section
 * with no buy box blocks says nothing about ours: no settings at all.
 */
export function mainProductProps(section: ShopifyTemplateSection): Props {
  const blocks = blocksOf(section)
  if (!blocks.some((b) => BUY_BOX_BLOCKS.has(b.type))) return {}
  const out: Props = {
    showRating: false,
    showVendor: false,
    showDescription: false,
    showShare: false,
    showStockBar: false,
    showPaymentSignals: false,
    showTrustBadges: false,
    showAssurance: false,
    showAccordions: false,
    showReturnsLine: false,
    showWhatsappAsk: false,
    showSpecs: false,
  }
  const accordions: { title: string; body: string; metafieldKey: string }[] = []
  const specFields: string[] = []
  if (str(section.settings?.gallery_layout) === 'stacked') out.galleryLayout = 'stacked'

  for (const { type, s } of blocks) {
    if (type.startsWith('shopify://apps/')) {
      if (RATING_APP.test(type)) out.showRating = true
      continue
    }
    switch (type) {
      case 'rating':
        out.showRating = true
        break
      case 'description':
        out.showDescription = true
        break
      case 'share':
      case 'share_row':
        out.showShare = true
        if (plainText(s.label ?? s.share_label))
          out.shareLabel = plainText(s.label ?? s.share_label)
        break
      case 'text':
        // Dawn draws the vendor as a text block holding `{{ product.vendor }}`.
        if (/product\.vendor/.test(str(s.text))) out.showVendor = true
        break
      case 'payment_signals': {
        out.showPaymentSignals = true
        if (plainText(s.text)) out.paymentNote = plainText(s.text)
        const percent = num(s.upi_percent)
        if (percent !== null) out.upiPercent = Math.min(50, Math.max(0, percent))
        if (plainText(s.offer_heading)) out.offerHeading = plainText(s.offer_heading)
        if (str(s.offer_body)) out.offerBody = str(s.offer_body)
        out.offerSupportLabel = plainText(s.offer_support_label)
        out.offerSupportUrl = str(s.offer_support_url)
        break
      }
      case 'stock_bar': {
        out.showStockBar = true
        const threshold = num(s.threshold)
        if (threshold !== null) out.stockThreshold = Math.min(100, Math.max(1, threshold))
        break
      }
      case 'inventory':
        out.showStockBar = true
        break
      case 'buy_buttons':
        if (typeof s.show_preorder_link === 'boolean') out.showPreorderLink = s.show_preorder_link
        if (str(s.preorder_link)) out.preorderLinkUrl = str(s.preorder_link)
        break
      case 'delivery_estimate':
        out.deliveryText = plainText(s.text)
        break
      case 'spec_group':
        if (str(s.fields).trim()) specFields.push(str(s.fields).trim())
        if (str(s.rows).trim() && !out.specRows) out.specRows = str(s.rows).trim()
        break
      case 'trust_badges': {
        const badges: { icon: string; label: string }[] = []
        for (let i = 1; i <= 6; i++) {
          const label = plainText(s[`label_${i}`])
          if (label) badges.push({ icon: str(s[`icon_${i}`]) || 'check', label })
        }
        out.showTrustBadges = true
        out.trustBadges = badges
        out.trustWhatsappLabel = plainText(s.whatsapp_label)
        whatsapp(out, s.whatsapp_number, s.whatsapp_message)
        break
      }
      case 'assurance':
        out.showAssurance = true
        out.assuranceReturns = plainText(s.returns_standard)
        out.assuranceReturnsPreorder =
          plainText(s.returns_preorder) || plainText(s.returns_standard)
        out.assuranceCod = plainText(s.cod)
        out.assuranceWhatsappLabel = plainText(s.whatsapp_label)
        whatsapp(out, s.whatsapp_number, s.whatsapp_message)
        break
      case 'returns_line':
        out.showReturnsLine = true
        if (!out.showAssurance && plainText(s.standard)) {
          out.assuranceReturns = plainText(s.standard)
          out.assuranceReturnsPreorder = plainText(s.standard)
        }
        break
      case 'whatsapp_ask':
        out.showWhatsappAsk = true
        if (plainText(s.label)) out.whatsappAskLabel = plainText(s.label)
        whatsapp(out, s.number, s.message)
        break
      case 'accordion':
        accordions.push({
          title: plainText(s.title),
          body: str(s.body),
          metafieldKey: str(s.metafield_key).trim(),
        })
        break
      // Dawn's collapsible rows.
      case 'collapsible_tab':
        accordions.push({ title: plainText(s.heading), body: str(s.content), metafieldKey: '' })
        break
    }
  }

  const shownAccordions = accordions.filter((a) => a.title)
  if (shownAccordions.length > 0) {
    out.showAccordions = true
    out.accordions = shownAccordions.slice(0, 6)
  }
  if (specFields.length > 0) {
    out.showSpecs = true
    out.specFields = specFields.join('\n')
  }
  return out
}
