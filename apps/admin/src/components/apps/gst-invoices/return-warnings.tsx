'use client'

import type { GstReturnWarning } from '@commerce/invoices'
import { CircleAlert, CircleCheck } from '@commerce/ui/icons'
import DataCard from '@/components/layout/data-card'
import { gstReturnsContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'

type ReturnWarningsProps = {
  warnings: readonly GstReturnWarning[]
}

/** Numbers shown per warning before "and N more". */
const SHOWN = 8

/** What to fix before uploading: each check with the documents it found. */
export default function ReturnWarnings({ warnings }: ReturnWarningsProps) {
  // Hooks
  const copy = useCopy(gstReturnsContent)

  // Render logic
  const w = copy.warnings

  return (
    <DataCard title={w.title} count={warnings.length}>
      {warnings.length === 0 ? (
        <p className="flex items-center gap-2 text-body text-muted-foreground">
          <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
          {w.none}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {warnings.map((x) => (
            <li key={x.code} className="flex gap-2 text-body">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span>{w.codes[x.code]}</span>
                <span className="text-caption break-words text-muted-foreground">
                  {x.numbers.slice(0, SHOWN).join(', ')}
                  {x.numbers.length > SHOWN ? ` ${w.more(x.numbers.length - SHOWN)}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
