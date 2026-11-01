'use client'

import { ChevronDown, Search } from '@commerce/ui/icons'
import { useState } from 'react'
import { assistantContent } from '@/data/assistant'
import type { AssistantSource } from '@/hooks/use-assistant'
import { useCopy } from '@/hooks/use-copy'

type AssistantQueryProps = {
  sources: AssistantSource[]
}

/**
 * "Show query": in plain words, which lookup ran and with which inputs ("Looked up top
 * products · Period: this month · How many: 5"), folded away by default.
 */
export default function AssistantQuery({ sources }: AssistantQueryProps) {
  // Hooks
  const copy = useCopy(assistantContent)
  const [open, setOpen] = useState(false)

  // Early returns
  const ran = sources.filter((s) => s.status === 'done')
  if (!ran.length) return null

  // Render logic
  const q = copy.query

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-fit items-center gap-1.5 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Search className="size-3.5" aria-hidden="true" />
        {open ? q.hide : q.show}
        <ChevronDown
          className={`size-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <ul className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 text-caption">
          {ran.map((source) => {
            const inputs = source.inputs ?? []
            return (
              <li key={source.id} className="flex flex-col gap-0.5">
                <span className="font-medium text-ink-strong">
                  {q.ran(copy.tools[source.tool] ?? source.tool)}
                </span>
                <span className="text-muted-foreground">
                  {inputs.length
                    ? inputs
                        .map(
                          (i) =>
                            `${q.inputs[i.key] ?? i.key}: ${i.key === 'period' ? (q.periods[i.value] ?? i.value) : i.value}`,
                        )
                        .join(' · ')
                    : q.noInputs}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
