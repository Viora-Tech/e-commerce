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
 * The open assistant: on desktop a right sidebar docked beside the content panel (Shopify
 * Sidekick style; the page narrows instead of being covered), on phones a full-height sheet.
 * The thread keeps itself scrolled to the newest answer while it streams.
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
      /* Owner 2026-10-17: a right sidebar, not a drawer: 440px, the full window height beside the
         top bar and the page, split off by a hairline. The host animates its width open and
         closed so the page narrows smoothly. Phones keep the bottom sheet. */
      className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] bottom-0 z-40 flex animate-in flex-col overflow-hidden rounded-t-2xl border border-border bg-popover shadow-dialog duration-400 ease-drawer fade-in slide-in-from-bottom-6 motion-reduce:animate-none md:static md:z-auto md:h-svh md:w-[27.5rem] md:animate-none md:rounded-none md:border-0 md:border-panel-border md:border-l md:bg-background md:shadow-none"
    >
      <header className="flex shrink-0 items-center gap-2.5 border-border border-b py-3.5 pr-3.5 pl-4.5">
        {/* The AI orb (Figma): a glowing disc in the AI colour. */}
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ai/15 text-ai shadow-ai-orb"
          aria-hidden="true"
        >
          <AiIcon className="size-3.5" />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[0.9375rem] leading-5 font-semibold text-ink-strong">
          {copy.panel.title}
        </h2>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {copy.panel.on(where)}
        </span>
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
