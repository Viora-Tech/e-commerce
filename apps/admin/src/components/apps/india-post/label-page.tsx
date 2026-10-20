'use client'

import { Download, Printer } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import type { AppPageProps } from '@/apps/registry'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import { indiaPostAppContent } from '@/data/india-post'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

/** `/apps/india-post/labels/<article number>`: our address label as a PDF, to print or save.
 *  This is the shipment's `labelUrl`, so "Print label" anywhere in the admin lands here. */
export default function LabelPage({ params }: AppPageProps) {
  // Hooks
  const copy = useCopy(indiaPostAppContent)
  const [file, setFile] = useState<File | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    api.shipments
      .indiaPostLabel({ waybill: params.waybill ?? '' })
      .then((f) => live && setFile(f))
      .catch((err) => live && setFailed(err instanceof Error ? err.message : copy.label.failed))
    return () => {
      live = false
    }
  }, [params.waybill, copy.label.failed])

  // Render logic
  const waybill = params.waybill ?? ''
  const body = failed ? (
    <p className="text-body text-muted-foreground">{failed}</p>
  ) : !file ? (
    <p className="flex items-center gap-2 text-body text-muted-foreground">
      <Spinner />
      {copy.label.loading}
    </p>
  ) : (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => saveFile(file, 'open')}>
        <Printer aria-hidden="true" />
        {copy.label.print}
      </Button>
      <Button variant="outline" onClick={() => saveFile(file)}>
        <Download aria-hidden="true" />
        {copy.label.download}
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.label.title(waybill)}
        back={{ label: copy.label.back, href: routes.apps.page('india-post') }}
      />
      <DataCard title={waybill}>{body}</DataCard>
    </div>
  )
}
