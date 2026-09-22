import type { TemplateData, TemplateId } from '../types'
import { sharedContent as shared, templateContent } from './content'

export type EmailBody = { subject: string; text: string; html: string }
export type WhatsappBody = { text: string }

export const TEMPLATE_IDS: TemplateId[] = ['order_placed', 'payment_received', 'order_shipped']

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Drop runs of blank lines left by optional sections. */
const squash = (lines: string[]): string =>
  lines.filter((l, i) => !(l === '' && lines[i - 1] === '')).join('\n')

export function renderEmail(template: TemplateId, d: TemplateData): EmailBody {
  const c = templateContent[template]
  const lines = d.lines.map(shared.lineText)
  const text = squash([
    c.heading(d),
    '',
    c.intro(d),
    '',
    `${shared.itemsHeading}:`,
    ...lines.map((l) => `- ${l}`),
    `${shared.totalLabel}: ${d.totalLabel}`,
    '',
    c.outro(d),
    d.orderUrl ? `${shared.viewOrder}: ${d.orderUrl}` : '',
    ...(d.links ?? []).map((l) => `${l.label}: ${l.url}`),
    '',
    shared.footer(d),
  ])

  const html = [
    '<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">',
    `<h1 style="font-size:20px">${escapeHtml(c.heading(d))}</h1>`,
    `<p>${escapeHtml(c.intro(d))}</p>`,
    `<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#666">${shared.itemsHeading}</h2>`,
    `<ul style="padding-left:18px">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`,
    `<p><strong>${shared.totalLabel}: ${escapeHtml(d.totalLabel)}</strong></p>`,
    `<p>${escapeHtml(c.outro(d))}</p>`,
    d.orderUrl ? `<p><a href="${escapeHtml(d.orderUrl)}">${shared.viewOrder}</a></p>` : '',
    ...(d.links ?? []).map(
      (l) => `<p><a href="${escapeHtml(l.url)}">${escapeHtml(l.label)}</a></p>`,
    ),
    `<p style="font-size:12px;color:#666">${escapeHtml(shared.footer(d))}</p>`,
    '</body></html>',
  ].join('\n')

  return { subject: c.subject(d), text, html }
}

export function renderWhatsapp(template: TemplateId, d: TemplateData): WhatsappBody {
  return { text: templateContent[template].whatsapp(d) }
}
