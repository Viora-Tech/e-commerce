'use client'

import { type DocumentKind, type InvoiceSettings, sampleDocument } from '@commerce/invoices'
import { cn } from '@commerce/ui/lib/utils'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { gstInvoicesContent } from '@/data/gst-invoices'

type PdfPreviewProps = {
  settings: InvoiceSettings
  kind: DocumentKind
  storeName: string
  logoUrl: string | null
  signatureUrl: string | null
}

type Inputs = [InvoiceSettings, DocumentKind, string, string | null, string | null]

const copy = gstInvoicesContent.settings
const FONT_BASE = '/api/apps/gst-invoices/fonts'
const DEBOUNCE_MS = 600

/** Render a sample order with the settings, in the browser, as a PDF blob. */
async function renderPreview([settings, kind, storeName, logo, signature]: Inputs): Promise<Blob> {
  const pdf = await import('@commerce/invoices/pdf')
  pdf.registerFonts((file) => `${FONT_BASE}/${file}`)
  const doc = sampleDocument(settings, kind, storeName)
  return pdf.renderDocumentToBlob({ doc, settings, assets: { logo, signature } })
}

/**
 * Live preview, ported from invoicely's invoice-preview loop: debounce the
 * inputs, render with react-pdf, swap the blob URL. The worker renders the
 * real PDFs with the same templates.
 */
export default function PdfPreview({
  settings,
  kind,
  storeName,
  logoUrl,
  signatureUrl,
}: PdfPreviewProps) {
  // Hooks
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setBusy(true)
      renderPreview([settings, kind, storeName, logoUrl, signatureUrl])
        .then((blob) => {
          if (cancelled) return
          const next = URL.createObjectURL(blob)
          setUrl((old) => {
            if (old) URL.revokeObjectURL(old)
            return next
          })
          setFailed(false)
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [settings, kind, storeName, logoUrl, signatureUrl])

  // Render logic
  const ratio = settings.paper === 'A5' ? 'aspect-[148/210]' : 'aspect-[210/297]'

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-[0.75rem] border border-border bg-muted',
          ratio,
        )}
      >
        {url ? (
          <iframe
            title={copy.previewOf}
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            className="absolute inset-0 size-full bg-background"
          />
        ) : null}
        {busy ? (
          <span className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-background px-3 py-1 text-caption text-muted-foreground shadow-sm">
            <Spinner className="size-3.5" />
            {copy.previewing}
          </span>
        ) : null}
      </div>
      {failed ? <p className="text-caption text-destructive">{copy.previewFailed}</p> : null}
    </div>
  )
}
