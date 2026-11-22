'use client'

import { Download, Printer } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import type { AppPageProps } from '@/apps/registry'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import { appsContent } from '@/data/apps'
import { indiaPostAppContent } from '@/data/india-post'
import { useCopy } from '@/hooks/use-copy'
import type { LoadFailure } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { isForbidden } from '@/lib/forbidden'
import { routes } from '@/lib/routes'

/** `/apps/india-post/labels/<article number>`: our address label as a PDF, to print or save.
 *  This is the shipment's `labelUrl`, so "Print label" anywhere in the admin lands here. */
export default function LabelPage({ params }: AppPageProps) {
  // Hooks
  const apps = useCopy(appsContent)
  const copy = useCopy(indiaPostAppContent)
  const [file, setFile] = useState<File | null>(null)
  /** The label read failed: "Could not load the label" with the reason and Try again. */
  const [failed, setFailed] = useState<{ kind: LoadFailure; reason: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is Try again
  useEffect(() => {
    let live = true
    setFailed(null)
    api.shipments
      .indiaPostLabel({ waybill: params.waybill ?? '' })
      .then((f) => live && setFile(f))
      .catch(
        (err: unknown) =>
          live &&
          setFailed({
            kind: isForbidden(err) ? 'no-access' : 'error',
            reason: errorText(err, copy.label.failed),
          }),
      )
    return () => {
      live = false
    }
  }, [params.waybill, copy.label.failed, attempt])

  // Render logic
  const waybill = params.waybill ?? ''
  const body = failed ? (
    <LoadFailedState
      heading={apps.couldNotLoad.label}
      body={failed.reason}
      failed={failed.kind}
      onRetry={() => setAttempt((n) => n + 1)}
    />
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
