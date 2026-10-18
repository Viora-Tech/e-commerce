'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import StatusChip from '@/components/layout/status-chip'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Properties = Awaited<ReturnType<typeof api.searchConsole.properties>>
type View = Awaited<ReturnType<typeof api.searchConsole.view>>

type PropertyPickerProps = {
  /** The property in use, if any. */
  current: string
  onSaved: (view: View) => void
}

const errorText = (fallback: string, err: unknown) =>
  err instanceof Error && err.message ? err.message : fallback

/**
 * The connected account's Search Console properties, read from Google, with the one matching
 * the store's live domain pre-selected; "Use this property" saves it and pulls the numbers.
 */
export default function PropertyPicker({ current, onSaved }: PropertyPickerProps) {
  // Hooks
  const copy = useCopy(searchConsoleContent)
  const [list, setList] = useState<Properties | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [choice, setChoice] = useState(current)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.searchConsole
      .properties()
      .then((p) => {
        if (cancelled) return
        setList(p)
        setChoice((c) => c || p.suggested || '')
      })
      .catch((err) => !cancelled && setError(errorText(copy.failed, err)))
    return () => {
      cancelled = true
    }
  }, [copy.failed])

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      const view = await api.searchConsole.chooseProperty({ property: choice })
      if (view.lastError) toast.error(view.lastError)
      else toast.success(copy.settings.property.saved)
      onSaved(view)
    } catch (err) {
      toast.error(errorText(copy.failed, err))
    } finally {
      setSaving(false)
    }
  }

  // Early returns
  if (error) return <p className="text-body text-destructive">{error}</p>
  if (!list) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }
  if (list.properties.length === 0) {
    return <p className="text-body text-muted-foreground">{copy.settings.property.none}</p>
  }

  // Render logic
  const p = copy.settings.property
  const host = list.hostnames[0]

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2" aria-label={p.title}>
        {list.properties.map((site) => (
          <li key={site.siteUrl}>
            <button
              type="button"
              aria-pressed={choice === site.siteUrl}
              disabled={!site.usable}
              onClick={() => setChoice(site.siteUrl)}
              className={cn(
                'flex w-full flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                choice === site.siteUrl
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-card hover:bg-muted',
              )}
            >
              <span className="min-w-0 flex-1 truncate font-mono text-body text-foreground">
                {site.siteUrl}
              </span>
              {site.siteUrl === current ? <StatusChip>{p.current}</StatusChip> : null}
              {site.siteUrl === list.suggested ? (
                <StatusChip tone="success">{p.suggested}</StatusChip>
              ) : null}
              {site.usable ? null : <StatusChip tone="attention">{p.unverified}</StatusChip>}
            </button>
          </li>
        ))}
      </ul>
      {!list.suggested && host ? (
        <p className="text-caption text-muted-foreground">{p.noMatch(host)}</p>
      ) : null}
      <div>
        <Button
          loading={saving}
          disabled={saving || !choice || choice === current}
          onClick={() => void handleSave()}
        >
          {p.save}
        </Button>
      </div>
    </div>
  )
}
