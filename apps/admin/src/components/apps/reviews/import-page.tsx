'use client'

import { CheckIcon, FileText } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ChangeEvent, useRef, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ImportPreview from './import-preview'

type Preview = Awaited<ReturnType<typeof api.reviews.judgeme.preview>>
type Ready = Extract<Preview, { ok: true }>

/** Same ceiling the API enforces (`JUDGEME_MAX_BYTES`). */
const MAX_BYTES = 4 * 1024 * 1024

/** Import from Judge.me (Apps, Reviews 20:670): export steps, upload, check, import. */
export default function ImportPage() {
  // Hooks
  const { import: copy } = useCopy(reviewsContent)
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; size: number; text: string } | null>(null)
  const [preview, setPreview] = useState<Ready | null>(null)
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [options, setOptions] = useState({ copyPhotos: true, publish: true })

  // Helpers
  const reset = () => {
    setFile(null)
    setPreview(null)
    if (input.current) input.current.value = ''
  }

  // Event handlers
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    if (!picked) return
    if (picked.size > MAX_BYTES) {
      toast.error(copy.errors.too_large)
      return
    }
    setReading(true)
    setPreview(null)
    try {
      const text = await picked.text()
      setFile({ name: picked.name, size: picked.size, text })
      const r = await api.reviews.judgeme.preview({ csv: text })
      if (!r.ok) {
        toast.error(copy.errors[r.error])
        reset()
        return
      }
      setPreview(r)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.read)
      reset()
    } finally {
      setReading(false)
    }
  }
  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    try {
      const r = await api.reviews.judgeme.import({ csv: file.text, ...options })
      if (!r.ok) {
        toast.error(copy.errors[r.error])
        return
      }
      toast.success(copy.done(r.imported, r.photosToCopy))
      router.push(routes.apps.page('reviews'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : reviewsContent.list.failed)
    } finally {
      setImporting(false)
    }
  }

  // Render logic
  const helpCards = (
    <>
      <DataCard title={copy.help.what}>
        <ul className="flex flex-col gap-2 text-body">
          {copy.help.whatItems.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </DataCard>
      <DataCard title={copy.help.safe}>
        <p className="text-body text-muted-foreground">{copy.help.safeBody}</p>
      </DataCard>
      <DataCard title={copy.help.after}>
        <p className="text-body text-muted-foreground">{copy.help.afterBody}</p>
      </DataCard>
    </>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        back={{ label: reviewsContent.detail.back, href: routes.apps.page('reviews') }}
      />
      <PageColumns
        main={
          <>
            <DataCard title={copy.step1.title}>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-body">
                {copy.step1.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </DataCard>
            <DataCard title={copy.step2.title}>
              <input
                ref={input}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                id="judgeme-csv"
                onChange={handleFile}
              />
              {file ? (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-success-soft text-success">
                    <FileText className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-strong">{file.name}</span>
                    <span className="text-caption text-muted-foreground">
                      {reading
                        ? copy.step2.reading
                        : copy.step2.rows(
                            Math.max(1, Math.round(file.size / 1024)),
                            preview?.total ?? 0,
                          )}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => input.current?.click()}
                    disabled={reading || importing}
                  >
                    {copy.step2.another}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <Button
                    variant="outline"
                    onClick={() => input.current?.click()}
                    disabled={reading}
                  >
                    {reading ? <Spinner /> : null}
                    {copy.step2.choose}
                  </Button>
                  <span className="text-caption text-muted-foreground">{copy.step2.hint}</span>
                </div>
              )}
            </DataCard>
            {preview ? (
              <ImportPreview
                preview={preview}
                options={options}
                onOptionsChange={setOptions}
                importing={importing}
                onImport={handleImport}
                onCancel={reset}
              />
            ) : null}
            {!preview && !file ? (
              <Button
                variant="ghost"
                className="self-start"
                nativeButton={false}
                render={<Link href={routes.apps.page('reviews')} />}
              >
                {copy.step3.cancel}
              </Button>
            ) : null}
          </>
        }
        side={helpCards}
      />
    </div>
  )
}
