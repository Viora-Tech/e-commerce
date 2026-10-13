import { resolve } from 'node:path'
import { loadEnv } from '@commerce/config'
import { installedApps, storageForStore } from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { withStore } from '@commerce/db'
import { verifyDocumentLink } from '@commerce/invoices/link'
import {
  GST_INVOICES_ID,
  getDocument,
  pdfBytes,
  pdfFilename,
} from '@commerce/plugin-gst-invoices/server'
import { db } from '@/lib/db'
import { withEvlog } from '@/lib/request-log'

/* Local development storage lives under the admin app; point this process at
   the same folder so it can read the PDFs the worker wrote. */
process.env.LOCAL_UPLOAD_ROOT ??= resolve(process.cwd(), '..', 'admin')

type Params = { params: Promise<{ storeId: string; id: string }> }

const notFound = () => new Response('Not found', { status: 404 })

/**
 * A GST document for the shopper. The link is the credential: an HMAC over
 * store, document and expiry, so it cannot be guessed from an order number
 * and stops working after 30 days. Invoices are never served by public URL.
 */
export const GET = withEvlog(async (req: Request, { params }: Params) => {
  const { storeId, id } = await params
  const url = new URL(req.url)
  const env = loadEnv(process.env)
  const ok = verifyDocumentLink(env.SETTINGS_SECRET, {
    storeId,
    documentId: id,
    expires: Number(url.searchParams.get('e')),
    token: url.searchParams.get('t') ?? '',
  })
  if (!ok) return new Response('This link has expired or is not valid.', { status: 403 })
  if (!(await installedApps(db(), storeId)).includes(GST_INVOICES_ID)) return notFound()

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
  const row = await deps.inStore((tx) => getDocument(tx, id))
  if (!row) return notFound()
  const bytes = await pdfBytes(deps, row.id)
  return new Response(bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${pdfFilename(row)}"`,
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex',
    },
  })
})
