'use client'

import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  Clock,
  Eye,
  Globe,
  Save,
  Undo,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import type { ReactNode } from 'react'
import { themeCodeContent } from '@/data/theme-code'
import { useCopy } from '@/hooks/use-copy'

type CodeTopBarProps = {
  themeName: string
  imported: boolean
  /** The file search (⌘P). */
  search: ReactNode
  dirty: boolean
  problems: number
  saving: boolean
  canUndo: boolean
  canSave: boolean
  versionsOpen: boolean
  previewHref: string
  /** Imported themes: files saved but not published yet. */
  drafts: number
  publishing: boolean
  onBack: () => void
  onUndo: () => void
  onVersions: () => void
  onSave: () => void
  onPublish: () => void
  onDiscard: () => void
}

const ICON_BUTTON =
  'flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40'

/**
 * Edit code's bar (Figma 699:93624): back, "Edit code" over the theme name and where the theme
 * came from; then search, the save state, undo, Version history, Preview and Save.
 */
export default function CodeTopBar({
  themeName,
  imported,
  search,
  dirty,
  problems,
  saving,
  canUndo,
  canSave,
  versionsOpen,
  previewHref,
  drafts,
  publishing,
  onBack,
  onUndo,
  onVersions,
  onSave,
  onPublish,
  onDiscard,
}: CodeTopBarProps) {
  // Hooks
  const copy = useCopy(themeCodeContent)

  // Render logic
  const state = problems ? (
    <span className="flex items-center gap-1.5 text-body text-destructive">
      <CircleAlert aria-hidden className="size-4" />
      {copy.status.problems(problems)}
    </span>
  ) : dirty ? (
    <span className="flex items-center gap-1.5 text-body text-warning">
      <span aria-hidden className="size-1.5 rounded-full bg-warning" />
      {copy.status.unsaved}
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-body text-muted-foreground">
      <CircleCheck aria-hidden className="size-4 text-success" />
      {copy.status.saved}
    </span>
  )

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
      <button
        type="button"
        onClick={onBack}
        aria-label={copy.back}
        title={copy.back}
        className={ICON_BUTTON}
      >
        <ArrowLeft aria-hidden className="size-4" />
      </button>
      <div className="flex min-w-0 flex-col">
        <h1 className="text-sm leading-5 font-semibold text-foreground">{copy.title}</h1>
        <span className="truncate text-caption text-muted-foreground">{themeName}</span>
      </div>
      <span
        className={cn(
          'rounded-md border px-2 py-0.5 text-caption',
          imported ? 'border-info-border bg-info-soft text-info' : 'border-border text-foreground',
        )}
      >
        {imported ? copy.badge.imported : copy.badge.native}
      </span>
      <div className="ml-auto flex items-center gap-3">
        {search}
        <span role="status" aria-live="polite">
          {state}
        </span>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={copy.undo}
          title={copy.undo}
          className={ICON_BUTTON}
        >
          <Undo aria-hidden className="size-4" />
        </button>
        <Button variant="ghost" onClick={onVersions} aria-pressed={versionsOpen}>
          <Clock aria-hidden />
          {copy.versions}
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={previewHref} target="_blank" rel="noreferrer" />}
        >
          <Eye aria-hidden />
          {copy.preview}
        </Button>
        <Button
          variant={drafts ? 'outline' : 'default'}
          onClick={onSave}
          disabled={!canSave || saving}
        >
          {saving ? <Spinner /> : <Save aria-hidden="true" />}
          {copy.save}
        </Button>
        {drafts ? (
          <>
            <span
              className="hidden items-center gap-1.5 text-body text-warning xl:flex"
              title={copy.drafts.help}
            >
              <span aria-hidden className="size-1.5 rounded-full bg-warning" />
              {copy.drafts.count(drafts)}
            </span>
            <Button variant="ghost" onClick={onDiscard} disabled={publishing}>
              {copy.drafts.discard}
            </Button>
            <Button onClick={onPublish} disabled={publishing} title={copy.drafts.help}>
              {publishing ? <Spinner /> : <Globe aria-hidden="true" />}
              {publishing ? copy.drafts.publishing : copy.drafts.publish}
            </Button>
          </>
        ) : null}
      </div>
    </header>
  )
}
