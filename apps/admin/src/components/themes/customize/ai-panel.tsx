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

type AiPanelProps = {
  /** The active store, so this conversation is the one the admin's AI bar keeps for it. */
  storeId: string | null
  /** AI is set up, on for the store, and this member may use the assistant. */
  enabled: boolean
}

/**
 * The rail's AI tab: the admin's AI assistant (the same conversation as its ⌘J bar) inside the
 * editor, with suggestions about the page being edited. It answers and runs its usual tools
 * with approval; it does not edit the canvas itself. Without AI it says where to turn it on.
 */
export default function AiPanel({ storeId, enabled }: AiPanelProps) {
  // Hooks
  const copy = useCopy(customizeContent.ai)
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
  if (!enabled) {
    return (
      <div className="flex flex-col items-start gap-3 px-4 py-6">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <AiIcon aria-hidden className="size-5" />
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
    )
  }

  // Render logic
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {assistant.turns.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-foreground">{copy.title}</p>
            <p className="text-xs text-muted-foreground">{copy.intro}</p>
            <ul className="flex flex-col gap-1.5">
              {copy.chips.map((chip) => (
                <li key={chip}>
                  <button
                    type="button"
                    onClick={() => handleSend(chip)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-border-strong hover:bg-muted/60"
                  >
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
      <div className="shrink-0 border-t border-border p-3">
        <AssistantComposer busy={assistant.busy} onSend={handleSend} onStop={assistant.stop} />
      </div>
    </div>
  )
}
