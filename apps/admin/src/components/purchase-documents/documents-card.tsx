'use client'

import {
  isPurchaseDocumentType,
  PURCHASE_DOCUMENT_MAX_BYTES,
  type PurchaseDocumentKind,
} from '@commerce/core/inventory'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmActionDialog from '@/components/inventory/confirm-action-dialog'
import OptionSelect from '@/components/landed-cost/option-select'
import type { ChargeOwner } from '@/components/landed-cost/types'
import { PURCHASE_DOCUMENT_KINDS, purchaseDocumentsContent } from '@/data/purchase-documents'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import DocumentDrop from './document-drop'
import DocumentRow, { type DocumentSummary } from './document-row'
import ReviewDialog from './review-dialog'

type DocumentsCardProps = {
  /** Null until the order or shipment is saved. */
  owner: ChargeOwner | null
  /** "Read with AI" is on for this store and this member. */
  aiReading: boolean
  /** Something was applied: the page reloads its order or shipment. */
  onApplied: () => void
}

const POLL_MS = 2500

const busy = (d: DocumentSummary) => d.status === 'pending' || d.status === 'reading'

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

/** Upload supplier and import bills, watch the AI read them, then check and apply each one. */
export default function DocumentsCard({ owner, aiReading, onApplied }: DocumentsCardProps) {
  // Hooks
  const copy = useCopy(purchaseDocumentsContent)
  const [docs, setDocs] = useState<DocumentSummary[]>([])
  const [kind, setKind] = useState<PurchaseDocumentKind>(() =>
    owner && 'inboundShipmentId' in owner ? 'bill_of_entry' : 'supplier_invoice',
  )
  const [uploading, setUploading] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the owner id stands in for owner (a new object each render); a document being read starts and stops the polling
  useEffect(() => {
    if (!owner) return
    let cancelled = false
    const load = () =>
      api.purchaseDocuments
        .list(owner)
        .then((rows) => !cancelled && setDocs(rows))
        .catch(() => undefined)
    load()
    const timer = docs.some(busy) ? setInterval(load, POLL_MS) : null
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [owner ? Object.values(owner)[0] : null, docs.some(busy)])

  // Helpers
  const refresh = async () => {
    if (owner) setDocs(await api.purchaseDocuments.list(owner))
  }

  const startRead = async (id: string) => {
    try {
      await api.purchaseDocuments.read({ id })
      toast.success(copy.readStarted)
    } catch (err) {
      toast.error(message(err, copy.failed))
    }
    await refresh()
  }

  // Event handlers
  const handleFiles = async (files: File[]) => {
    if (!owner) return
    setUploading(true)
    try {
      for (const file of files) {
        if (!isPurchaseDocumentType(file.type)) {
          toast.error(copy.wrongType)
          continue
        }
        if (file.size > PURCHASE_DOCUMENT_MAX_BYTES) {
          toast.error(copy.tooBig)
          continue
        }
        const up = await api.purchaseDocuments.upload({ ...owner, kind, file })
        toast.success(aiReading ? copy.uploaded : copy.uploadedNoAi)
        if (aiReading) await api.purchaseDocuments.read({ id: up.id }).catch(() => undefined)
      }
    } catch (err) {
      toast.error(message(err, copy.failed))
    } finally {
      setUploading(false)
      await refresh()
    }
  }

  const handleRemove = async () => {
    if (!removing) return
    try {
      await api.purchaseDocuments.delete({ id: removing })
      toast.success(copy.removed)
      await refresh()
    } catch (err) {
      toast.error(message(err, copy.failed))
    } finally {
      setRemoving(null)
    }
  }

  const handleApplied = async () => {
    setReviewing(null)
    await refresh()
    onApplied()
  }

  // Render logic
  return (
    <Card size="form" gap="none" inset="y-none">
      <CardHeader className="py-5">
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.summary}</CardDescription>
      </CardHeader>
      {owner ? (
        <CardContent className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-stretch">
          <div className="flex flex-col gap-1.5 sm:w-56">
            <span className="text-caption font-medium text-muted-foreground">{copy.kindLabel}</span>
            <OptionSelect
              id="document-kind"
              options={PURCHASE_DOCUMENT_KINDS}
              labels={copy.kinds}
              value={kind}
              onChange={setKind}
            />
          </div>
          <div className="min-w-0 flex-1">
            <DocumentDrop disabled={uploading} uploading={uploading} onFiles={handleFiles} />
          </div>
        </CardContent>
      ) : null}
      {!owner ? (
        <p className="border-line border-t px-5 py-8 text-center text-body text-muted-foreground">
          {copy.saveFirst}
        </p>
      ) : docs.length === 0 ? (
        <p className="border-line border-t px-5 py-6 text-center text-body text-muted-foreground">
          {copy.empty}
        </p>
      ) : (
        <ul className="flex flex-col border-line border-t">
          {docs.map((d) => (
            <DocumentRow
              key={d.id}
              doc={d}
              aiReading={aiReading}
              onReview={() => setReviewing(d.id)}
              onRead={() => startRead(d.id)}
              onRemove={() => setRemoving(d.id)}
            />
          ))}
        </ul>
      )}
      {reviewing ? (
        <ReviewDialog
          id={reviewing}
          onOpenChange={(open) => !open && setReviewing(null)}
          onApplied={handleApplied}
          onReset={refresh}
        />
      ) : null}
      <ConfirmActionDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        copy={copy.confirmRemove}
        destructive
        onConfirm={handleRemove}
      />
    </Card>
  )
}
