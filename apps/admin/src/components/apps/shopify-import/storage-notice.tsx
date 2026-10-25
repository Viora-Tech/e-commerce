'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import HealthLine from '@/components/settings/health-line'
import { storageWarningContent } from '@/data/storage-warning'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

/** Cloud providers that keep files outside the app container (same list as the Home warning). */
const CLOUD = new Set(['r2', 's3'])

/**
 * Before products, images or files are imported: a notice while a production store still
 * keeps uploads on the server disk. "Import anyway" hides it for this visit.
 */
export default function StorageNotice() {
  // Hooks
  const copy = useCopy(storageWarningContent.importer)
  const [local, setLocal] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Development keeps files in a local folder on purpose.
    if (process.env.NODE_ENV !== 'production') return
    api.store
      .getStorage()
      .then((r) => setLocal(!r.settings.enabled.some((id: string) => CLOUD.has(id))))
      .catch(() => {})
  }, [])

  // Early returns
  if (!local || dismissed) return null

  return (
    <HealthLine
      tone="bad"
      title={copy.title}
      help={copy.body}
      action={
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href={routes.content.storage()} />}>
            {copy.action}
          </Button>
          <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
            {copy.anyway}
          </Button>
        </div>
      }
    />
  )
}
