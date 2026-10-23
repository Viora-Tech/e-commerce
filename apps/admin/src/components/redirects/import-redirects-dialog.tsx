'use client'

import { Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { redirectsContent } from '@/data/redirects'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type ImportRedirectsDialogProps = {
  onClose: () => void
  onImported: () => void
}

type Preview = Awaited<ReturnType<typeof api.redirects.importCsv>> & { csv: string; name: string }

/** Same limit as the API: a redirects CSV is two short columns. */
const MAX_CHARS = 2_000_000
/** Problems listed before "and N more". */
const SHOWN = 20

/**
 * Import redirects from a CSV: pick the file, see how many rows are ready and which lines are
 * skipped (a dry run, nothing written), then import.
 */
export default function ImportRedirectsDialog({ onClose, onImported }: ImportRedirectsDialogProps) {
  // Hooks
  const { csv: copy } = useCopy(redirectsContent)
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleFile = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    try {
      const csv = await file.text()
      if (csv.length > MAX_CHARS) {
        toast.error(copy.tooBig)
        return
      }
      const r = await api.redirects.importCsv({ csv, dryRun: true })
      setPreview({ ...r, csv, name: file.name })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const handleImport = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const r = await api.redirects.importCsv({ csv: preview.csv })
      toast.success(copy.done(r.created, r.updated))
      onImported()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const problems = preview?.problems ?? []

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            <Upload aria-hidden="true" />
            {copy.choose}
          </Button>
          {preview ? <span className="text-body text-muted-foreground">{preview.name}</span> : null}
        </div>
        {busy && !preview ? (
          <p className="text-body text-muted-foreground">{copy.reading}</p>
        ) : null}
        {preview ? (
          <div className="flex flex-col gap-2 text-body">
            <p className="text-ink-strong">
              {preview.rows > 0 ? copy.ready(preview.rows) : copy.nothing}
            </p>
            {problems.length > 0 ? (
              <div className="flex flex-col gap-1 rounded-lg bg-warning-soft px-3 py-2">
                <p className="text-ink-strong">{copy.problems(problems.length)}</p>
                <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto text-caption text-muted-foreground">
                  {problems.slice(0, SHOWN).map((p) => (
                    <li key={`${p.line}:${p.reason}`}>{copy.line(p.line, p.reason)}</li>
                  ))}
                  {problems.length > SHOWN ? <li>{copy.more(problems.length - SHOWN)}</li> : null}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {copy.cancel}
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={busy || !preview || preview.rows === 0}
          >
            <Upload aria-hidden="true" />
            {busy && preview ? copy.importing : copy.confirm(preview?.rows ?? 0)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
