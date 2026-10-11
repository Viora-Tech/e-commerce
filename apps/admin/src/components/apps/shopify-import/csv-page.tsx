'use client'

import {
  CSV_RESOURCES,
  type CsvResource,
  MAX_CSV_BYTES,
} from '@commerce/plugin-shopify-import/client'
import { Package, ShoppingBag, Users } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ChoiceCard from '@/components/layout/choice-card'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import CsvDropzone from './csv-dropzone'
import CsvHelp from './csv-help'

const base = shopifyImportContent.base

const KIND_ICON = { products: Package, customers: Users, orders: ShoppingBag } as const

/** Upload one of Shopify's CSV exports; the preview starts at once. */
export default function CsvPage() {
  // Hooks
  const copy = useCopy(shopifyImportContent.csv)
  const router = useRouter()
  const [resource, setResource] = useState<CsvResource>('products')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<'notCsv' | 'tooBig' | null>(null)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleFile = (next: File | null) => {
    setError(null)
    if (!next) return
    if (!/\.csv$/i.test(next.name)) {
      setFile(null)
      return setError('notCsv')
    }
    if (next.size > MAX_CSV_BYTES) {
      setFile(null)
      return setError('tooBig')
    }
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{copy.kindHeading}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {CSV_RESOURCES.map((kind) => (
              <ChoiceCard
                key={kind}
                layout="tile"
                icon={KIND_ICON[kind]}
                label={copy.kinds[kind].label}
                description={copy.kinds[kind].short}
                selected={resource === kind}
                onSelect={() => setResource(kind)}
              />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{copy.fileHeading}</CardTitle>
          </CardHeader>
          <CardContent>
            <CsvDropzone file={file} error={error} onFile={handleFile} />
          </CardContent>
        </Card>
        <div className="flex flex-col items-end gap-1.5">
          <Button type="button" onClick={handlePreview} disabled={!file || busy}>
            {busy ? <Spinner /> : null}
            {copy.preview}
          </Button>
          {file ? null : <p className="text-caption text-muted-foreground">{copy.previewHint}</p>}
        </div>
      </div>
      <CsvHelp resource={resource} />
    </div>
  )
}
