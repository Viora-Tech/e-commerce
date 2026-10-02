'use client'

import { AiIcon, ArrowRight } from '@commerce/ui/icons'
import { assistantContent } from '@/data/assistant'
import { useCopy } from '@/hooks/use-copy'

type AssistantEmptyProps = {
  /** Suggestions for the page the merchant is on. */
  chips: string[]
  onPick: (message: string) => void
}

/** A fresh conversation: one line on what the assistant can do, and this page's suggestions. */
export default function AssistantEmpty({ chips, onPick }: AssistantEmptyProps) {
  // Hooks
  const copy = useCopy(assistantContent)

  return (
    <div className="flex h-full flex-col justify-end gap-5">
      <div className="flex flex-col gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <AiIcon className="size-5 text-primary" aria-hidden="true" />
        </span>
        <h3 className="text-lg font-semibold text-ink-strong">{copy.panel.greeting}</h3>
        <p className="max-w-md text-body text-muted-foreground">{copy.panel.intro}</p>
      </div>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {chips.map((chip) => (
          <li key={chip}>
            <button
              type="button"
              onClick={() => onPick(chip)}
              className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-body text-foreground transition-colors hover:bg-muted/60"
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
  )
}
