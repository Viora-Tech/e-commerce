'use client'

import { FileText } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { gstInvoiceEditContent } from '@/data/gst-invoice-edit'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { formatDateTime } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'
import { saveFile } from './save-file'

type Version = Awaited<ReturnType<typeof api.gstInvoices.getEdit>>['versions'][number]

type InvoiceHistoryListProps = {
  invoiceId: string
  versions: Version[]
}

/** "Edited 2 times" and each earlier version: who, when, why, what changed, its totals and PDF. */
export default function InvoiceHistoryList({ invoiceId, versions }: InvoiceHistoryListProps) {
  // Hooks
  const copy = useCopy(gstInvoiceEditContent.history)
  const sheetCopy = useCopy(gstInvoiceEditContent.sheet)
  const [busy, setBusy] = useState<number | null>(null)

  // Event handlers
  const handleOpen = async (version: number) => {
    setBusy(version)
    try {
      saveFile(await api.gstInvoices.getVersionPdf({ id: invoiceId, version }), 'open')
    } catch (err) {
      toast.error(errorText(err, sheetCopy.failed))
    } finally {
      setBusy(null)
    }
  }

  // Render logic
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body font-medium">{copy.count(versions.length)}</p>
      <ul className="flex flex-col divide-y divide-line">
        {versions.map((v) => (
          <li key={v.version} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-body">
                {copy.version(v.version)}
                <span className="text-muted-foreground">
                  {' · '}
                  {copy.total(formatPaise(v.totals.totalPaise))},{' '}
                  {copy.taxable(formatPaise(v.totals.taxablePaise))}
                </span>
              </p>
              <p className="text-caption text-muted-foreground">
                {copy.by(v.createdBy ?? copy.someone, formatDateTime(v.createdAt))}
              </p>
              {v.reason ? <p className="text-caption">{copy.reason(v.reason)}</p> : null}
              {v.changes.length > 0 ? (
                <ul className="flex list-disc flex-col gap-0.5 pl-4 text-caption text-muted-foreground">
                  {v.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              loading={busy === v.version}
              disabled={busy !== null}
              onClick={() => handleOpen(v.version)}
            >
              <FileText aria-hidden="true" />
              {copy.openPdf}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
