'use client'

import { pageContextFor } from '@commerce/ai/client'
import { AiIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import AssistantComposer from '@/components/assistant/assistant-composer'
import AssistantTurnView from '@/components/assistant/assistant-turn'
import { customizeContent } from '@/data/customize'
import { useAssistant } from '@/hooks/use-assistant'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import PanelTitle from './panel-title'
import SectionProposer from './section-proposer'

type AiPanelProps = {
  /** The active store, so this conversation is the one the admin's AI bar keeps for it. */
  storeId: string | null
  /** AI is set up, on for the store, and this member may use the assistant. */
  enabled: boolean
  /** The template being edited ("Home page"), for "Build a section". */
  page: string
}

/**
 * The rail's AI tab (Figma 385:4119 "AI · idle"): "Build with AI" with New chat, the admin's AI
 * assistant (the same conversation as its ⌘J bar) inside the editor, with suggestions about the
 * page being edited and the prompt box at the foot. It answers and runs its usual tools
 * with approval. "Build a section" above it proposes one library section, which goes on the
 * canvas only when the merchant adds it. Without AI it says where to turn it on.
 */
export default function AiPanel({ storeId, enabled, page }: AiPanelProps) {
  // Hooks
  const copy = useCopy(customizeContent.ai)
  const rail = useCopy(customizeContent.rail)
  const pathname = usePathname()
  const locale = useLocale()
  const assistant = useAssistant(storeId)
  const scroller = useRef<HTMLDivElement>(null)
  // Keep the newest answer in view while it streams.
  useEffect(() => {
    if (!assistant.turns.length) return
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [assistant.turns])

  // Event handlers
  const handleSend = (message: string) => {
    void assistant.send(message, pageContextFor(pathname), locale)
  }

  // Early returns
  const head = (
    <PanelTitle
      icon={<AiIcon aria-hidden weight="regular" className="size-4" />}
      title={rail.ai}
      action={
        enabled ? (
          <button
            type="button"
            onClick={assistant.clear}
            disabled={assistant.busy}
            className="rounded-sm text-xs leading-[1.0625rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none disabled:opacity-50"
          >
            {copy.newChat}
          </button>
        ) : null
      }
    />
  )

  if (!enabled) {
    return (
      <>
        {head}
        <div className="flex flex-col items-start gap-3 px-4 pb-6">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <AiIcon aria-hidden weight="regular" className="size-5" />
          </span>
          <p className="text-sm font-semibold text-foreground">{copy.offTitle}</p>
          <p className="text-xs text-muted-foreground">{copy.offBody}</p>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={routes.settings.ai()} target="_blank" />}
          >
            {copy.offAction}
          </Button>
        </div>
      </>
    )
  }

  // Render logic
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {head}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {assistant.turns.length === 0 ? (
          <div className="flex flex-col gap-4">
            <SectionProposer page={page} />
            <p className="text-sm leading-5 text-muted-foreground">{copy.title}</p>
            <ul className="flex flex-col gap-4">
              {copy.chips.map((chip) => (
                <li key={chip}>
                  <button
                    type="button"
                    onClick={() => handleSend(chip)}
                    className="flex min-h-[2.8125rem] w-full items-center gap-2 rounded-[0.625rem] border border-border bg-card px-3 py-2.5 text-left text-[0.8125rem] leading-[1.1875rem] text-foreground transition-colors hover:border-border-strong hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none"
                  >
                    <AiIcon
                      aria-hidden
                      weight="regular"
                      className="size-3.5 shrink-0 text-primary"
                    />
                    {chip}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="flex flex-col gap-6">
            {assistant.turns.map((turn) => (
              <AssistantTurnView key={turn.id} turn={turn} onAction={assistant.replaceAction} />
            ))}
          </ol>
        )}
      </div>
      <div className="shrink-0 px-4 pb-4">
        <AssistantComposer busy={assistant.busy} onSend={handleSend} onStop={assistant.stop} />
      </div>
    </div>
  )
}
