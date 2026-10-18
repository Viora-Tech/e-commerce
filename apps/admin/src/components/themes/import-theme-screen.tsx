'use client'

import { CheckIcon, CircleAlert, Upload } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import { themeImportContent } from '@/data/theme-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ImportSteps from './import-steps'

/** Same ceiling the API enforces (`themes.import.shopify`). */
const MAX_BYTES = 50 * 1024 * 1024

const sizeLabel = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

/**
 * Online Store › Themes › Import a Shopify theme: the upload card, the licence tick and the old
 * store's address; then the working state while the zip is read; then the failed state with a way
 * to pick another file. The theme always lands as a new unpublished theme; the report opens next.
 */
export default function ImportThemeScreen() {
  // Hooks
  const { dialog: copy, screen } = useCopy(themeImportContent)
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
      router.push(routes.onlineStore.themeImport(result.theme.id))
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : copy.failed)
      setBusy(false)
    }
  }

  // Render logic
  const failed = error !== null && !busy
  const ready = Boolean(file) && owned && !busy
  const back = { label: screen.back, href: routes.onlineStore.themes() }

  if (busy) {
    return (
      <ProoflyPageBody>
        <PageHeader title={screen.workingTitle} summary={screen.workingSubtitle} back={back} />
        <div className="surface-card flex flex-col gap-4 rounded-xl p-5">
          <p className="text-body font-semibold text-ink-strong">{screen.progress}</p>
          <div
            role="progressbar"
            aria-label={screen.progress}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full w-2/5 animate-pulse rounded-full bg-primary" />
          </div>
          <ImportSteps />
          <p className="text-body text-muted-foreground">{copy.importing}</p>
        </div>
      </ProoflyPageBody>
    )
  }

  return (
    <ProoflyPageBody>
      <PageHeader
        title={screen.title}
        summary={failed ? screen.failedSubtitle : screen.subtitle}
        back={back}
      />
      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3"
        >
          <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-body font-semibold text-ink-strong">{screen.failedTitle}</p>
            <p className="text-caption text-muted-foreground">{error}</p>
          </div>
          <Button variant="key-neutral" size="sm" onClick={() => input.current?.click()}>
            {screen.chooseAnother}
          </Button>
        </div>
      ) : null}
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      <div
        className={cn(
          'surface-card flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 text-center',
          file || failed ? 'py-10' : 'py-16',
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Upload className="size-6" aria-hidden />
        </span>
        <p className="text-card-title text-ink-strong">{screen.drop}</p>
        <p className="max-w-lg text-body text-muted-foreground">{screen.dropBody}</p>
        <Button onClick={() => input.current?.click()}>
          <Upload aria-hidden />
          {file ? copy.change : copy.choose}
        </Button>
        <p className="text-caption text-muted-foreground">
          {file ? `${file.name}, ${sizeLabel(file.size)}` : screen.limits}
        </p>
      </div>
      {file ? (
        <div className="surface-card flex flex-col gap-5 rounded-xl p-5">
          <p className="text-body text-muted-foreground">{copy.howTo}</p>
          <Field>
            <FieldLabel htmlFor="shopify-host">{copy.host}</FieldLabel>
            <Input
              id="shopify-host"
              size="lg"
              value={host}
              maxLength={200}
              placeholder={copy.hostPlaceholder}
              autoComplete="off"
              onChange={(e) => setHost(e.target.value)}
            />
            <FieldDescription>{copy.hostHint}</FieldDescription>
          </Field>
          <Field orientation="horizontal" className="items-start">
            <Checkbox
              id="theme-owned"
              checked={owned}
              onCheckedChange={(v) => setOwned(v === true)}
              className="mt-0.5"
            />
            <FieldLabel htmlFor="theme-owned">{copy.licenceConfirm}</FieldLabel>
          </Field>
          <p className="text-caption text-muted-foreground">{copy.licence}</p>
          <div className="flex justify-end">
            <Button disabled={!ready} onClick={handleImport}>
              {copy.confirm}
            </Button>
          </div>
        </div>
      ) : null}
      <ul className="flex flex-col gap-2.5">
        {screen.bullets.map((line) => (
          <li key={line} className="flex items-start gap-2.5 text-body text-foreground">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
    </ProoflyPageBody>
  )
}
