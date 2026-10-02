'use client'

import { AiIcon, ArrowRight } from '@commerce/ui/icons'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import DataCard from '@/components/layout/data-card'
import { assistantContent } from '@/data/assistant'
import { useCopy } from '@/hooks/use-copy'
import { modKey, openAssistant } from '@/lib/assistant-events'

/**
 * Home's way into the AI assistant: suggested questions and things it can do. Each opens the
 * AI bar and sends; the conversation itself lives in the bar, on every page.
 */
export default function AskAiCard() {
  // Hooks
  const copy = useCopy(assistantContent)

  // Render logic
  const groups = [
    { label: copy.home.examplesAsk, chips: (copy.chips.home ?? []).slice(0, 3) },
    { label: copy.home.examplesDo, chips: copy.home.doChips },
  ]

  return (
    <DataCard
      title={copy.home.title}
      meta={copy.home.subtitle}
      icon={<AiIcon className="size-5 text-primary" aria-hidden="true" />}
    >
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => openAssistant()}
          className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-input bg-card pr-2 pl-3.5 text-left transition-[border-color,scale] duration-150 ease-out hover:border-border-strong active:scale-[0.995]"
        >
          <span className="min-w-0 flex-1 truncate text-body text-muted-foreground">
            {copy.home.ask}
          </span>
          <span className="hidden shrink-0 items-center gap-0.5 sm:flex" aria-hidden="true">
            <Kbd>{modKey()}</Kbd>
            <Kbd>J</Kbd>
          </span>
        </button>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-1.5">
              <p className="text-caption font-medium text-muted-foreground uppercase">
                {group.label}
              </p>
              <ul className="flex flex-col">
                {group.chips.map((chip) => (
                  <li key={chip}>
                    <button
                      type="button"
                      onClick={() => openAssistant(chip)}
                      className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-body text-foreground transition-colors hover:bg-muted/60"
                    >
                      <span className="min-w-0 flex-1">{chip}</span>
                      <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </DataCard>
  )
}
