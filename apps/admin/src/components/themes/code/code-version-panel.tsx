'use client'

import { RotateCcw } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { themeCodeContent } from '@/data/theme-code'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { CodeFileVersion } from '@/lib/theme-code'

export type PickedVersion = { version: CodeFileVersion; body: string }

type CodeVersionPanelProps = {
  themeId: string
  path: string
  /** The theme is live: its newest version is what shoppers see ("Live"). */
  live: boolean
  /** Who is editing now, for the "Now · Draft" row. */
  me: string
  picked: string | null
  /** "Restore whole theme" is offered (a native theme's templates share one version). */
  canRestoreTheme: boolean
  /** Theme settings: no versions are kept. */
  noHistory: boolean
  onPick: (picked: PickedVersion | null) => void
  onRestoreFile: () => void
  onRestoreTheme: (batchId: string) => Promise<void>
}

/**
 * Versions of the open file (Figma 699:94938): "Now" first, then each save, newest first, with
 * who and when; Live and Imported are tagged. Picking one compares it with the open file.
 */
export default function CodeVersionPanel({
  themeId,
  path,
  live,
  me,
  picked,
  canRestoreTheme,
  noHistory,
  onPick,
  onRestoreFile,
  onRestoreTheme,
}: CodeVersionPanelProps) {
  // Hooks
  const copy = useCopy(themeCodeContent.history)
  const format = useFormat()
  const [versions, setVersions] = useState<CodeFileVersion[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  useEffect(() => {
    if (noHistory) return
    let current = true
    setVersions(null)
    setFailed(false)
    api.themes.code
      .versions({ themeId, path })
      .then((v) => {
        if (current) setVersions(v)
      })
      .catch(() => {
        if (current) setFailed(true)
      })
    return () => {
      current = false
    }
  }, [themeId, path, noHistory])

  // Helpers
  const tagOf = (v: CodeFileVersion, i: number) => {
    if (v.reason === 'import') return copy.imported
    if (v.reason === 'create') return copy.created
    if (live && i === 0) return copy.live
    if (v.reason === 'publish') return copy.published
    return null
  }

  // Event handlers
  const handlePick = async (v: CodeFileVersion) => {
    setLoadingId(v.id)
    try {
      const { body } = await api.themes.code.version({ themeId, path, versionId: v.id })
      onPick({ version: v, body })
    } catch {
      setFailed(true)
    } finally {
      setLoadingId(null)
    }
  }

  const handleRestoreTheme = async () => {
    const batchId = versions?.find((v) => v.id === picked)?.batchId
    if (!batchId) return
    setRestoring(true)
    try {
      await onRestoreTheme(batchId)
    } finally {
      setRestoring(false)
    }
  }

  // Render logic
  const pickedVersion = versions?.find((v) => v.id === picked) ?? null

  return (
    <aside
      aria-label={copy.heading}
      className="flex w-[16.25rem] shrink-0 flex-col border-l border-border bg-card"
    >
      <h2 className="flex h-9 items-center px-3 font-mono text-caption tracking-wide text-muted-foreground uppercase">
        {copy.heading}
      </h2>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2">
        <li>
          <button
            type="button"
            onClick={() => onPick(null)}
            aria-pressed={picked === null}
            className={cn(
              'flex w-full flex-col rounded-md px-2.5 py-2 text-left transition-colors',
              picked === null ? 'bg-muted' : 'hover:bg-muted/60',
            )}
          >
            <span className="flex items-center justify-between text-body text-foreground">
              {copy.now}
              <span className="font-mono text-caption text-muted-foreground">{copy.draft}</span>
            </span>
            <span className="text-caption text-muted-foreground">{me}</span>
          </button>
        </li>
        {noHistory ? (
          <li className="px-2.5 py-2 text-caption text-muted-foreground">{copy.noHistory}</li>
        ) : failed ? (
          <li className="px-2.5 py-2 text-caption text-destructive">{copy.loadFailed}</li>
        ) : versions === null ? (
          <li className="flex flex-col gap-2 px-2.5 py-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </li>
        ) : versions.length === 0 ? (
          <li className="px-2.5 py-2 text-caption text-muted-foreground">{copy.empty}</li>
        ) : (
          versions.map((v, i) => {
            const tag = tagOf(v, i)
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => void handlePick(v)}
                  aria-pressed={picked === v.id}
                  className={cn(
                    'flex w-full flex-col rounded-md px-2.5 py-2 text-left transition-colors',
                    picked === v.id ? 'bg-muted' : 'hover:bg-muted/60',
                  )}
                >
                  <span className="flex items-center justify-between gap-2 text-body text-foreground">
                    {format.dateTime(v.createdAt)}
                    {loadingId === v.id ? (
                      <Spinner className="size-3" />
                    ) : tag ? (
                      <span className="font-mono text-caption text-muted-foreground">{tag}</span>
                    ) : null}
                  </span>
                  {v.createdBy ? (
                    <span className="text-caption text-muted-foreground">{v.createdBy}</span>
                  ) : null}
                </button>
              </li>
            )
          })
        )}
      </ul>
      {pickedVersion ? (
        <div className="flex flex-col gap-2 p-3">
          <Button variant="secondary" onClick={onRestoreFile}>
            <RotateCcw aria-hidden="true" />
            {copy.restoreFile}
          </Button>
          {canRestoreTheme && pickedVersion.batchId ? (
            <Button
              variant="outline"
              onClick={() => void handleRestoreTheme()}
              disabled={restoring}
              title={copy.restoreThemeHelp}
            >
              {restoring ? <Spinner /> : <RotateCcw aria-hidden="true" />}
              {copy.restoreTheme}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="p-3 text-caption text-muted-foreground">{copy.pick}</p>
      )}
    </aside>
  )
}
