'use client'

import type { DataRequestRow } from '@commerce/core'
import { type ExportFormat, isOpenStatus } from '@commerce/core/privacy'
import { CircleCheck, Download, Play, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import DataCard from '@/components/layout/data-card'
import DeclineRequestDialog from '@/components/privacy/decline-request-dialog'
import EraseCustomerDialog from '@/components/privacy/erase-customer-dialog'
import { dataRequestDetailContent as copy } from '@/data/customer-privacy'
import { api } from '@/lib/api-client'

type DataRequestActionsProps = {
  request: DataRequestRow
  customer: { id: string; anonymisedAt: Date | null } | null
  onChanged: () => void
}

/** The next step for a request, one decision at a time. */
export default function DataRequestActions({
  request,
  customer,
  onChanged,
}: DataRequestActionsProps) {
  // Hooks
  const [busy, setBusy] = useState(false)
  const [erasing, setErasing] = useState(false)
  const [declining, setDeclining] = useState(false)

  // Helpers
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(done)
      onChanged()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      return false
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleStatus = (status: 'in_progress' | 'completed') =>
    run(() => api.customerPrivacy.updateRequest({ id: request.id, status }), copy.updated)

  const handleExport = (format: ExportFormat) => {
    if (!customer) return
    void run(async () => {
      const file = await api.customerPrivacy.export({
        customerId: customer.id,
        format,
        dataRequestId: request.id,
      })
      saveFile(new File([file.body], file.filename, { type: file.contentType }))
    }, copy.exported)
  }

  const handleErase = async () => {
    if (!customer) return
    const ok = await run(
      () => api.customerPrivacy.anonymise({ customerId: customer.id, dataRequestId: request.id }),
      copy.erasedToast,
    )
    if (ok) setErasing(false)
  }

  const handleDecline = async (reason: string) => {
    const ok = await run(
      () =>
        api.customerPrivacy.updateRequest({
          id: request.id,
          status: 'rejected',
          resolution: reason,
        }),
      copy.updated,
    )
    if (ok) setDeclining(false)
  }

  // Early returns
  if (!isOpenStatus(request.status)) return null

  // Render logic
  const live = customer && !customer.anonymisedAt ? customer : null
  const canExport = request.kind === 'export' && live
  const canErase = request.kind === 'delete' && live

  return (
    <DataCard title={copy.steps.heading}>
      <div className="flex flex-col gap-4">
        <p className="text-body">
          {request.kind === 'export' ? copy.steps.export : copy.steps.delete}
        </p>
        <div className="flex flex-wrap gap-2">
          {request.status === 'open' ? (
            <Button variant="outline" disabled={busy} onClick={() => handleStatus('in_progress')}>
              <Play aria-hidden="true" />
              {copy.start}
            </Button>
          ) : null}
          {canExport ? (
            <>
              <Button variant="outline" disabled={busy} onClick={() => handleExport('json')}>
                <Download aria-hidden="true" />
                {copy.exportJson}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => handleExport('csv')}>
                <Download aria-hidden="true" />
                {copy.exportCsv}
              </Button>
            </>
          ) : null}
          {canErase ? (
            <Button variant="destructive" disabled={busy} onClick={() => setErasing(true)}>
              <Trash2 aria-hidden="true" />
              {copy.erase}
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => handleStatus('completed')}>
              <CircleCheck aria-hidden="true" />
              {copy.complete}
            </Button>
          )}
          <Button variant="ghost" disabled={busy} onClick={() => setDeclining(true)}>
            {copy.decline}
          </Button>
        </div>
      </div>
      <EraseCustomerDialog
        open={erasing}
        busy={busy}
        onOpenChange={setErasing}
        onConfirm={handleErase}
      />
      <DeclineRequestDialog
        open={declining}
        busy={busy}
        onClose={() => setDeclining(false)}
        onDecline={handleDecline}
      />
    </DataCard>
  )
}
