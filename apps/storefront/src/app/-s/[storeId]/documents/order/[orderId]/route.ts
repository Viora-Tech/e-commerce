import { resolve } from 'node:path'
import { loadEnv } from '@commerce/config'
import { installedApps, storageForStore } from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { withStore } from '@commerce/db'
import { documentLinkPath, verifyOrderInvoiceLink } from '@commerce/invoices/link'
import {
  GST_INVOICES_ID,
  hasPdf,
  liveDocuments,
  pdfBytes,
  pdfFilename,
} from '@commerce/plugin-gst-invoices/server'
import { invoiceLinkContent as copy } from '@/data/invoice-link'
import { db } from '@/lib/db'
import { withEvlog } from '@/lib/request-log'

/* Local development storage lives under the admin app (see documents/[id]/route.ts). */
process.env.LOCAL_UPLOAD_ROOT ??= resolve(process.cwd(), '..', 'admin')

type Params = { params: Promise<{ storeId: string; orderId: string }> }

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** A bare page for "not ready yet" and a split order's list; never cached, never indexed. */
function page(body: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(copy.title)}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5">${body}</body></html>`
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex',
    },
  })
}

/**
 * An order's GST invoice for the shopper, from the payment email. The email goes out before the
 * invoice is issued, so the link names the order (HMAC over store, order and expiry, 30 days) and
 * this finds the invoice when it is opened: one invoice is served as its PDF, a split order lists
 * each invoice's own signed link, and none yet says it is being prepared.
 */
export const GET = withEvlog(async (req: Request, { params }: Params) => {
  const { storeId, orderId } = await params
  const url = new URL(req.url)
  const env = loadEnv(process.env)
  const ok = verifyOrderInvoiceLink(env.SETTINGS_SECRET, {
    storeId,
    orderId,
    expires: Number(url.searchParams.get('e')),
    token: url.searchParams.get('t') ?? '',
  })
  if (!ok) return new Response(copy.invalid, { status: 403 })
  if (!(await installedApps(db(), storeId)).includes(GST_INVOICES_ID)) {
    return new Response('Not found', { status: 404 })
  }

  const deps = {
    storeId,
    inStore: <T>(fn: Parameters<typeof withStore<T>>[2]) => withStore(db(), storeId, fn),
    storage: () =>
      withStore(db(), storeId, async (tx) =>
        storageForStore(
          tx,
          storeId,
          (await registriesForStore(tx, storeId)).storage,
          env.SETTINGS_SECRET,
        ),
      ),
  }
  const rows = (await deps.inStore((tx) => liveDocuments(tx, orderId, 'tax_invoice'))).filter(
    (r) => r.status === 'issued' && hasPdf(r),
  )
  const [only] = rows
  if (!only) return page(`<p>${escapeHtml(copy.notReady)}</p>`)
  if (rows.length > 1) {
    const items = rows
      .map((r) => {
        const href = documentLinkPath(env.SETTINGS_SECRET, { storeId, documentId: r.id })
        return `<li><a href="${escapeHtml(href)}">${escapeHtml(copy.invoice(r.number))}</a></li>`
      })
      .join('')
    return page(`<p>${escapeHtml(copy.several)}</p><ul>${items}</ul>`)
  }
  const bytes = await pdfBytes(deps, only.id)
  return new Response(bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${pdfFilename(only)}"`,
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex',
    },
  })
})
