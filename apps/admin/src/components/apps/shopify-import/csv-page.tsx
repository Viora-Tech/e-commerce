'use client'

import {
  CSV_RESOURCES,
  type CsvResource,
  MAX_CSV_BYTES,
} from '@commerce/plugin-shopify-import/client'
import { Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

const base = shopifyImportContent.base

/** Upload one of Shopify's CSV exports; the preview starts at once. */
export default function CsvPage() {
  // Hooks
  const copy = useCopy(shopifyImportContent.csv)
  const router = useRouter()
  const [resource, setResource] = useState<CsvResource>('products')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<'notCsv' | 'tooBig' | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  // Event handlers
  const handleFile = (next: File | null) => {
    setError(null)
    setFile(null)
    if (!next) return
    if (!/\.csv$/i.test(next.name)) return setError('notCsv')
    if (next.size > MAX_CSV_BYTES) return setError('tooBig')
    setFile(next)
  }

  const handlePreview = async () => {
    if (!file) return
    setBusy(true)
    try {
      const csv = await file.text()
      const run = await api.shopifyImport.createCsvRun({ resource, fileName: file.name, csv })
      router.push(`${base}/runs/${run.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      setBusy(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <Card>
        <CardHeader>
          <CardTitle>{copy.kindHeading}</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={resource} onValueChange={(v) => setResource(String(v) as CsvResource)}>
            {CSV_RESOURCES.map((kind) => (
              <Field key={kind} orientation="horizontal" className="items-start">
                <RadioGroupItem id={`csv-kind-${kind}`} value={kind} className="mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor={`csv-kind-${kind}`}>{copy.kinds[kind].label}</FieldLabel>
                  <FieldDescription>{copy.kinds[kind].help}</FieldDescription>
                </div>
              </Field>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.fileHeading}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => input.current?.click()}>
              <Upload />
              {file ? copy.replace : copy.choose}
            </Button>
            <span className="text-body text-muted-foreground">
              {file ? `${file.name}, ${copy.size(file.size)}` : copy.none}
            </span>
          </div>
          {error ? <p className="text-body text-destructive">{copy[error]}</p> : null}
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="button" onClick={handlePreview} disabled={!file || busy}>
          {busy ? <Spinner /> : null}
          {copy.preview}
        </Button>
      </div>
    </div>
  )
}
