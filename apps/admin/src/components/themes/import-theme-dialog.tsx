'use client'

import { Upload } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { themeImportContent } from '@/data/theme-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type ImportThemeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Same ceiling the API enforces (`themes.import.shopify`). */
const MAX_BYTES = 50 * 1024 * 1024

const sizeLabel = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

/**
 * Online Store › Themes › Import Shopify theme: the licence notice, the zip Shopify
 * emails, and the old store's address for copying pictures. The theme always lands as
 * a new unpublished theme; the import report opens next.
 */
export default function ImportThemeDialog({ open, onOpenChange }: ImportThemeDialogProps) {
  // Hooks
  const { dialog: copy } = useCopy(themeImportContent)
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [host, setHost] = useState('')
  const [owned, setOwned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  // Event handlers
  const handleFile = (next: File | null) => {
    setError(null)
    if (!next) return setFile(null)
    if (!next.name.toLowerCase().endsWith('.zip')) {
      setFile(null)
      setError(copy.notZip)
      return
    }
    if (next.size > MAX_BYTES) {
      setFile(null)
      setError(copy.tooLarge)
      return
    }
    setFile(next)
  }

  const handleImport = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.themes.import.shopify({
        file,
        ...(host.trim() ? { shopifyHost: host.trim() } : {}),
      })
      toast.success(copy.done(result.theme.name))
      router.push(`/online-store/themes/${result.theme.id}/import`)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : copy.failed)
      setBusy(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (busy) return
    onOpenChange(next)
  }

  // Render logic
  const ready = Boolean(file) && owned && !busy

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <Alert>
          <AlertTitle>{copy.licenceTitle}</AlertTitle>
          <AlertDescription>{copy.licence}</AlertDescription>
        </Alert>
        <p className="text-body text-muted-foreground">{copy.howTo}</p>
        <Field>
          <FieldLabel>{copy.file}</FieldLabel>
          <input
            ref={input}
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Upload aria-hidden />
              {file ? copy.change : copy.choose}
            </Button>
            <span className="min-w-0 truncate text-body text-muted-foreground">
              {file ? `${file.name}, ${sizeLabel(file.size)}` : copy.fileHint}
            </span>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="shopify-host">{copy.host}</FieldLabel>
          <Input
            id="shopify-host"
            size="lg"
            value={host}
            maxLength={200}
            placeholder={copy.hostPlaceholder}
            disabled={busy}
            autoComplete="off"
            onChange={(e) => setHost(e.target.value)}
          />
          <FieldDescription>{copy.hostHint}</FieldDescription>
        </Field>
        <Field orientation="horizontal" className="items-start">
          <Checkbox
            id="theme-owned"
            checked={owned}
            disabled={busy}
            onCheckedChange={(v) => setOwned(v === true)}
            className="mt-0.5"
          />
          <FieldLabel htmlFor="theme-owned">{copy.licenceConfirm}</FieldLabel>
        </Field>
        {error ? <p className="text-body text-destructive">{error}</p> : null}
        {busy ? (
          <p className="flex items-center gap-2 text-body text-muted-foreground">
            <Spinner />
            {copy.importing}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button disabled={!ready} onClick={handleImport}>
            {busy ? <Spinner /> : null}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
