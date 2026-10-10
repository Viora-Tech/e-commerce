'use client'

import { AiIcon, Download, FileText, RotateCcw, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { toast } from 'sonner'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import KitIconButton from '@/components/kit/kit-icon-button'
import StatusChip from '@/components/layout/status-chip'
import { purchaseDocumentsContent } from '@/data/purchase-documents'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type DocumentSummary = Awaited<ReturnType<typeof api.purchaseDocuments.list>>[number]

type DocumentRowProps = {
  doc: DocumentSummary
  aiReading: boolean
  onReview: () => void
  onRead: () => void
  onRemove: () => void
}

const TONE = {
  pending: 'neutral',
  reading: 'info',
  ready: 'attention',
  failed: 'danger',
  applied: 'neutral',
} as const

/** One uploaded bill: name, kind, where the AI reading is, and what can be done next. */
export default function DocumentRow({
  doc,
  aiReading,
  onReview,
  onRead,
  onRemove,
}: DocumentRowProps) {
  // Hooks
  const copy = useCopy(purchaseDocumentsContent)
  const fmt = useFormat()

  // Event handlers
  const handleDownload = async () => {
    try {
      saveFile(await api.purchaseDocuments.download({ id: doc.id }))
    } catch {
      toast.error(copy.failed)
    }
  }

  // Render logic
  const error =
    doc.status === 'failed' && doc.error ? copy.errors[doc.error as keyof typeof copy.errors] : null
  const reviewable = doc.status === 'ready' || doc.status === 'applied'
  const readable = aiReading && (doc.status === 'failed' || doc.status === 'pending')

  return (
    <li className="flex flex-wrap items-center gap-3 border-line border-b px-5 py-3 last:border-b-0">
      <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body">{doc.fileName}</span>
        <span className="text-caption text-muted-foreground">
          {[
            copy.kinds[doc.kind],
            copy.size(Math.round(doc.sizeBytes / 1024)),
            fmt.date(doc.createdAt),
          ].join(' · ')}
        </span>
        {error ? <span className="text-caption text-danger">{error}</span> : null}
      </span>
      <StatusChip tone={TONE[doc.status]}>{copy.status[doc.status]}</StatusChip>
      <span className="flex items-center gap-1">
        {reviewable ? (
          <Button
            variant={doc.status === 'ready' ? 'default' : 'outline'}
            size="sm"
            onClick={onReview}
          >
            {doc.status === 'ready' ? copy.review : copy.view}
          </Button>
        ) : null}
        {readable ? (
          <Button variant="outline" size="sm" onClick={onRead}>
            {doc.status === 'failed' ? (
              <RotateCcw aria-hidden="true" />
            ) : (
              <AiIcon aria-hidden="true" />
            )}
            {doc.status === 'failed' ? copy.readAgain : copy.read}
          </Button>
        ) : null}
        <KitIconButton label={copy.download} className="size-9" onClick={handleDownload}>
          <Download aria-hidden="true" />
        </KitIconButton>
        <KitIconButton label={copy.remove} className="size-9" onClick={onRemove}>
          <Trash2 aria-hidden="true" />
        </KitIconButton>
      </span>
    </li>
  )
}
