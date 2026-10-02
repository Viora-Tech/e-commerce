'use client'

import type { AssistantPage } from '@commerce/ai/client'
import { AiIcon, Plus, X } from '@commerce/ui/icons'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { useEffect, useRef } from 'react'
import { assistantContent } from '@/data/assistant'
import type { ActionView, AssistantTurn } from '@/hooks/use-assistant'
import { useCopy } from '@/hooks/use-copy'
import { modKey } from '@/lib/assistant-events'
import AssistantComposer from './assistant-composer'
import AssistantEmpty from './assistant-empty'
import AssistantTurnView from './assistant-turn'

type AssistantPanelProps = {
  page: AssistantPage
  turns: AssistantTurn[]
  busy: boolean
  onSend: (message: string) => void
  onStop: () => void
  onClear: () => void
  onClose: () => void
  onAction: (view: ActionView) => void
}

/**
 * The open AI bar: a floating panel at the bottom centre on desktop, a full-height sheet on
 * phones. Opens and closes with no animation (⌘J is pressed many times a day). The thread
 * keeps itself scrolled to the newest answer while it streams.
 */
export default function AssistantPanel({
  page,
  turns,
  busy,
  onSend,
  onStop,
  onClear,
  onClose,
  onAction,
}: AssistantPanelProps) {
  // Hooks
  const copy = useCopy(assistantContent)
  const scroller = useRef<HTMLDivElement>(null)
  // Keep the newest answer in view while it streams and when a card changes.
  useEffect(() => {
    if (!turns.length) return
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns])

  // Render logic
  const where = copy.pages[page] ?? copy.pages.other ?? ''
  const chips = copy.chips[page] ?? copy.chips.other ?? []

  return (
    <section
      data-assistant
      role="dialog"
      aria-modal="false"
      aria-label={copy.panel.title}
      className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] bottom-0 z-40 flex flex-col overflow-hidden rounded-t-2xl border border-border bg-popover shadow-[0_24px_64px_-12px_hsl(211_42%_16%/0.28),0_4px_12px_-4px_hsl(211_42%_16%/0.12)] md:inset-x-auto md:top-auto md:bottom-5 md:left-1/2 md:ml-[calc(var(--sidebar-width,0rem)/2)] md:max-h-[min(46rem,calc(100svh-6rem))] md:min-h-[26rem] md:w-[min(42rem,calc(100vw-var(--sidebar-width,0rem)-4rem))] md:-translate-x-1/2 md:rounded-2xl"
    >
      <header className="flex shrink-0 items-center gap-2.5 border-border border-b px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <AiIcon className="size-4 text-primary" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h2 className="truncate text-body font-semibold text-ink-strong">{copy.panel.title}</h2>
          <span className="truncate text-caption text-muted-foreground">
            {copy.panel.on(where)}
          </span>
        </div>
        {turns.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="flex h-8 items-center gap-1 rounded-md px-2 text-caption font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {copy.panel.newChat}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.panel.close}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
        {turns.length === 0 ? (
          <AssistantEmpty chips={chips} onPick={onSend} />
        ) : (
          <ol className="flex flex-col gap-7">
            {turns.map((turn) => (
              <AssistantTurnView key={turn.id} turn={turn} onAction={onAction} />
            ))}
          </ol>
        )}
      </div>

      <footer className="shrink-0 border-border border-t px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {turns.length > 0 && !busy ? (
          <div className="no-scrollbar -mx-3 mb-2.5 flex gap-1.5 overflow-x-auto px-3">
            {chips.slice(0, 3).map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onSend(chip)}
                className="h-7 shrink-0 rounded-full border border-border bg-card px-3 text-caption text-foreground transition-colors hover:border-border-strong hover:bg-muted/60"
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}
        <AssistantComposer busy={busy} onSend={onSend} onStop={onStop} />
        <p className="mt-2 flex items-center justify-between gap-3 px-1 text-caption text-muted-foreground">
          <span>{copy.panel.disclaimer}</span>
          <span className="hidden shrink-0 items-center gap-1 md:flex">
            <Kbd>{modKey()}</Kbd>
            <Kbd>J</Kbd>
            {copy.panel.shortcut}
          </span>
        </p>
      </footer>
    </section>
  )
}
