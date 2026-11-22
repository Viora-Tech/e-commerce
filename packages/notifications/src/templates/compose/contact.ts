import type { EmailBlock } from '../../emails/blocks'
import { emailAsset, whatsappLink } from '../../emails/theme'
import type { TemplateData } from '../../types'
import { blockCopy } from '../content-blocks'

const c = () => blockCopy.contact

/**
 * "WhatsApp us" with the logo, to the store's wa.me chat (Settings, Store details, phone: the
 * same number the help box at the end uses). Null when the store has no number, so it hides.
 */
export function whatsappButton(d: TemplateData, opts: { note?: boolean } = {}): EmailBlock | null {
  const url = whatsappLink(d.brand?.supportPhone)
  if (!url) return null
  return {
    kind: 'whatsapp',
    label: c().whatsappUs,
    url,
    logoSrc: emailAsset(d.brand?.shopUrl, 'whatsapp-green'),
    note: opts.note ? c().whatsappNote : undefined,
  }
}

/** The order's invoice link an app added (`kind: 'invoice'`), if any. */
export function invoiceLink(d: TemplateData): { label: string; url: string } | undefined {
  return d.links?.find((l) => l.kind === 'invoice')
}

/**
 * The order's invoice as a file with "Download invoice" (the GST invoices app's signed link,
 * which opens without signing in and only for this order). Null when the store sends none.
 */
export function invoiceFile(d: TemplateData): EmailBlock | null {
  const link = invoiceLink(d)
  if (!link) return null
  return {
    kind: 'attachment',
    badge: blockCopy.updates.pdf,
    name: c().invoiceName(d.orderNumber),
    meta: c().invoiceMeta,
    link: { label: c().downloadInvoice, url: link.url },
  }
}
