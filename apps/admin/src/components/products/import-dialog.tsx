'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { type ChangeEvent, useState } from 'react'
import { toast } from 'sonner'
import { productsListContent } from '@/data/products'
import { api } from '@/lib/api-client'

type Preview = Awaited<ReturnType<typeof api.products.previewImport>>

type ImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

const copy = productsListContent.importing

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-body-strong tabular-nums">{value}</p>
    </div>
  )
}

/** Upload a Shopify CSV, show what it would do, then write it. */
export default function ImportDialog({ open, onOpenChange, onImported }: ImportDialogProps) {
  // Hooks
  const [csv, setCsv] = useState<string | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)

  // Helpers
  const reset = () => {
    setCsv(null)
    setFilename(null)
    setPreview(null)
  }

  // Event handlers
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setFilename(file.name)
    try {
      const text = await file.text()
      setCsv(text)
      setPreview(await api.products.previewImport({ csv: text }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      reset()
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    if (!csv) return
    setBusy(true)
    try {
      const outcome = await api.products.import({ csv })
      toast.success(copy.done(outcome.created, outcome.updated))
      if (outcome.failed.length > 0) toast.error(copy.failedRows(outcome.failed.length))
      onImported()
      onOpenChange(false)
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  // Render logic
  const summary = preview?.summary

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.intro}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Input
            type="file"
            accept=".csv,text/csv"
            aria-label={copy.choose}
            onChange={handleFile}
            disabled={busy}
          />
          {filename ? (
            <p className="text-caption text-muted-foreground">{copy.chosen(filename)}</p>
          ) : null}

          {summary ? (
            <div className="flex flex-col gap-3">
              <p className="text-body-strong">{copy.preview}</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Count label={copy.created} value={summary.created} />
                <Count label={copy.updated} value={summary.updated} />
                <Count label={copy.variants} value={summary.variants} />
                <Count label={copy.issues} value={summary.issues} />
              </div>
              {preview.ignoredColumns.length > 0 ? (
                <p className="text-caption text-muted-foreground">
                  {copy.ignored(preview.ignoredColumns)}
                </p>
              ) : null}
              {preview.sample.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-caption text-muted-foreground">{copy.sample}</p>
                  <ul className="flex flex-col gap-1">
                    {preview.sample.map((row) => (
                      <li key={row.handle} className="flex items-center gap-2 text-body">
                        <Badge variant={row.exists ? 'neutral' : 'success'}>
                          {row.exists ? copy.exists : copy.isNew}
                        </Badge>
                        <span className="truncate">{row.title}</span>
                        <span className="text-muted-foreground">({row.variants})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {preview.issues.length > 0 ? (
                <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
                  {preview.issues.map((issue) => (
                    <li
                      key={`${issue.row}-${issue.handle ?? ''}-${issue.message}`}
                      className="text-caption text-destructive"
                    >
                      {issue.handle ? `${issue.handle}: ` : ''}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            {copy.cancel}
          </Button>
          <Button onClick={handleImport} disabled={busy || !summary || summary.total === 0}>
            {busy ? copy.running : copy.start}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
