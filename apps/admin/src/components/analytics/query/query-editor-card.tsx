'use client'

import type { QueryError } from '@commerce/core/analytics-query'
import {
  ArrowRight,
  ChevronDown,
  ChevronUpIcon,
  CircleAlert,
  CircleCheck,
  Redo,
  Undo,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import type { ReactNode } from 'react'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import QueryEditor from './query-editor'
import QueryHelpPopover from './query-help-popover'

type QueryEditorCardProps = {
  text: string
  /** The problem with the text (parser or server), or null when it is valid. */
  error: QueryError | null
  /** The last run failed to reach the server. */
  failed: boolean
  busy: boolean
  /** "Ran in 0.12 s · 10 rows", once a run has answered. */
  ranLine: string | null
  collapsed: boolean
  canUndo: boolean
  canRedo: boolean
  /** The date range and Compare pills. */
  rangeBar: ReactNode
  /** "Describe what you want", or nothing when AI is off for the platform. */
  aiInput: ReactNode
  onType: (text: string) => void
  onRun: () => void
  onFormat: () => void
  onUndo: () => void
  onRedo: () => void
  onToggleCollapsed: () => void
}

/**
 * The query card (Figma "query editor", Shopify's ShopifyQL editor): a live "Valid query" or
 * error line, undo and redo, help, Format and Run, the date pills, the editor, and the AI box.
 */
export default function QueryEditorCard(props: QueryEditorCardProps) {
  // Hooks
  const copy = useCopy(analyticsContent.query)

  // Render logic
  const { error, failed, busy, ranLine, collapsed } = props
  const status = error ? (
    <span className="flex min-w-0 items-center gap-1.5 text-danger" role="alert">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        {copy.errorLine(error.line, error.message)}
        {error.suggestion ? ` ${copy.didYouMean(error.suggestion)}` : null}
      </span>
    </span>
  ) : failed ? (
    <span className="flex items-center gap-1.5 text-danger" role="alert">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      {copy.failed}
    </span>
  ) : (
    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground" aria-live="polite">
      {busy ? (
        <Spinner className="size-3.5" />
      ) : (
        <CircleCheck className="size-3.5 text-success" aria-hidden="true" />
      )}
      <span className="font-medium text-foreground">{busy ? copy.running : copy.valid}</span>
      {ranLine && !busy ? <span className="truncate">· {ranLine}</span> : null}
    </span>
  )

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center gap-1 border-border border-b px-3 py-2">
        <div className="min-w-0 flex-1 text-caption">{status}</div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={copy.undo}
          disabled={!props.canUndo}
          onClick={props.onUndo}
        >
          <Undo className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={copy.redo}
          disabled={!props.canRedo}
          onClick={props.onRedo}
        >
          <Redo className="size-4" />
        </Button>
        <QueryHelpPopover />
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={collapsed ? copy.expand : copy.collapse}
          aria-expanded={!collapsed}
          onClick={props.onToggleCollapsed}
        >
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUpIcon className="size-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={props.onFormat}>
          {copy.format}
        </Button>
        <Button size="sm" onClick={props.onRun} disabled={busy}>
          <ArrowRight />
          {copy.run}
        </Button>
      </header>
      <div className="border-border border-b px-3 py-2">{props.rangeBar}</div>
      {collapsed ? null : (
        <QueryEditor
          value={props.text}
          errorLine={error?.line ?? null}
          onChange={props.onType}
          onRun={props.onRun}
          onUndo={props.onUndo}
          onRedo={props.onRedo}
        />
      )}
      {props.aiInput}
    </section>
  )
}
