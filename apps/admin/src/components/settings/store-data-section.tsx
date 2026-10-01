'use client'

import { Download, Trash2, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import { storeDataContent } from '@/data/store-data'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import DeleteStoreDialog from './delete-store-dialog'
import StoreExportList from './store-export-list'

type Overview = Awaited<ReturnType<typeof api.storeData.overview>>

const POLL_MS = 3_000

const isWorking = (o: Overview | null) =>
  !!o?.exports.some((e) => e.status === 'queued' || e.status === 'running')

const messageOf = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

/**
 * Bottom of Settings › General: "Download your data" (a full export, built in the
 * background and listed here until it expires) and the "Delete store" danger zone, which
 * only the owner sees enabled. Renders nothing for a member who can do neither.
 */
export default function StoreDataSection() {
  // Hooks
  const copy = useCopy(storeDataContent)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    api.storeData
      .overview()
      .then(setOverview)
      .catch(() => setOverview(null))
  }, [])
  useEffect(() => {
    // While an export is being built, check back every few seconds.
    if (!isWorking(overview)) return
    const timer = setInterval(() => {
      api.storeData
        .overview()
        .then(setOverview)
        .catch(() => undefined)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [overview])

  // Event handlers
  const handleExport = async () => {
    setRequesting(true)
    try {
      await api.storeData.requestExport()
      setOverview(await api.storeData.overview())
      toast.success(copy.export.started)
    } catch (err) {
      toast.error(messageOf(err, copy.export.failedToStart))
    } finally {
      setRequesting(false)
    }
  }

  const handleDownload = async (id: string) => {
    setDownloadingId(id)
    try {
      saveFile(await api.storeData.downloadExport({ id }))
    } catch (err) {
      toast.error(messageOf(err, copy.export.downloadFailed))
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (typed: string) => {
    setDeleting(true)
    try {
      await api.storeData.deleteStore({ confirm: typed })
      toast.success(copy.dialog.done)
      // The store is gone: the admin root picks another store or starts onboarding.
      window.location.assign('/')
    } catch (err) {
      toast.error(messageOf(err, copy.dialog.failed))
      setDeleting(false)
    }
  }

  // Early returns
  if (!overview || (!overview.canExport && !overview.canDelete)) return null

  // Render logic
  const working = isWorking(overview)

  return (
    <>
      {overview.canExport ? (
        <Card size="form" id="store-data" className="scroll-mt-6">
          <CardHeader>
            <CardTitle>{copy.export.heading}</CardTitle>
            <CardDescription>{copy.export.help}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button onClick={handleExport} disabled={requesting || working}>
                <Download aria-hidden="true" />
                {working ? copy.export.working : copy.export.action}
              </Button>
              <p className="text-caption text-muted-foreground">
                {copy.export.keptFor(overview.keptDays)} {copy.export.filesNote}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-body-strong text-foreground">{copy.export.recent}</p>
              <StoreExportList
                exports={overview.exports}
                downloadingId={downloadingId}
                onDownload={handleDownload}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card size="form" id="delete-store" className="scroll-mt-6 border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert aria-hidden="true" className="size-5" />
            {copy.danger.heading}
          </CardTitle>
          <CardDescription>{copy.danger.help}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            variant="destructive"
            onClick={() => setDialogOpen(true)}
            disabled={!overview.canDelete || deleting}
          >
            <Trash2 aria-hidden="true" />
            {copy.danger.action}
          </Button>
          <p className="text-caption text-muted-foreground">
            {overview.canDelete ? copy.danger.exportFirst : copy.danger.ownerOnly}
          </p>
        </CardContent>
      </Card>

      <DeleteStoreDialog
        open={dialogOpen}
        storeName={overview.storeName}
        busy={deleting}
        onOpenChange={setDialogOpen}
        onConfirm={handleDelete}
      />
    </>
  )
}
