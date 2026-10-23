'use client'

import { RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { meilisearchContent } from '@/data/meilisearch'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type View = Awaited<ReturnType<typeof api.meilisearch.get>>

type IndexCardProps = {
  view: View
  onChanged: () => Promise<void>
}

/** The search index: products in it, when it last changed, any problem, and "Reindex now". */
export default function IndexCard({ view, onChanged }: IndexCardProps) {
  // Hooks
  const copy = useCopy(meilisearchContent)
  const fmt = useFormat()
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleReindex = async () => {
    setBusy(true)
    try {
      await api.meilisearch.reindex()
      await onChanged()
      toast.success(copy.index.queued)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const connected = view.host !== '' && view.hasAdminKey
  const documents =
    view.documents === null ? copy.index.unknown : copy.index.count(fmt.number(view.documents))
  const problem = view.lastError ?? view.statsError

  return (
    <SettingsCard title={copy.index.title} description={copy.index.description}>
      <SettingsRow label={copy.index.documents}>
        <span className="text-body text-foreground">{documents}</span>
        {view.indexing ? (
          <span className="text-caption text-muted-foreground">{copy.index.indexingNow}</span>
        ) : null}
      </SettingsRow>
      <SettingsRow label={copy.index.lastSync}>
        <span className="text-body text-foreground">
          {view.lastSyncAt ? fmt.when(view.lastSyncAt) : copy.index.never}
        </span>
      </SettingsRow>
      {problem ? (
        <SettingsRow label={copy.index.error}>
          <span className="text-body text-destructive">{problem}</span>
        </SettingsRow>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          loading={busy}
          disabled={busy || !connected || view.reindexing}
          onClick={handleReindex}
        >
          <RefreshCw aria-hidden="true" />
          {copy.index.reindex}
        </Button>
        {view.reindexing ? (
          <span className="text-caption text-muted-foreground">{copy.index.reindexing}</span>
        ) : null}
      </div>
    </SettingsCard>
  )
}
