'use client'

import { BarChart3, ChevronDown } from '@commerce/ui/icons'
import { useState } from 'react'
import { assistantContent } from '@/data/assistant'
import type { AssistantSource } from '@/hooks/use-assistant'
import { useCopy } from '@/hooks/use-copy'

type AssistantSourcesProps = {
  sources: AssistantSource[]
}

/**
 * "Data used": the store numbers an answer was built from, folded away by default, and a
 * plain note when a tool shared a personal detail with the AI (an order's first name).
 */
export default function AssistantSources({ sources }: AssistantSourcesProps) {
  // Hooks
  const copy = useCopy(assistantContent)
  const [open, setOpen] = useState(false)

  // Early returns
  const done = sources.filter((s) => s.status === 'done' && s.facts.length > 0)
  if (!done.length) return null

  // Render logic
  const shared = [...new Set(sources.flatMap((s) => s.shared))]

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-fit items-center gap-1.5 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <BarChart3 className="size-3.5" aria-hidden="true" />
        {open ? copy.panel.sourcesHide : copy.panel.sources(done.length)}
        <ChevronDown
          className={`size-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3">
          {done.map((source) => (
            <dl
              key={source.id}
              className="grid grid-cols-1 gap-x-4 gap-y-1 text-caption sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              {source.facts.map((fact, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: facts can repeat a label across rows
                <div key={`${fact.label}-${i}`} className="contents">
                  <dt className="text-muted-foreground">{fact.label}</dt>
                  <dd className="font-medium text-ink-strong tabular-nums sm:text-right">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      ) : null}
      {shared.length ? (
        <p className="text-caption text-muted-foreground">{copy.panel.shared(shared.join(', '))}</p>
      ) : null}
    </div>
  )
}
