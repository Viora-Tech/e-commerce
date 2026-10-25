'use client'

import { CheckIcon, Loader2Icon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useEffect, useState } from 'react'
import { themeImportContent } from '@/data/theme-import'
import { useCopy } from '@/hooks/use-copy'

/** Roughly how long each stage takes; the upload is one request, so this paces the list, never past the last stage. */
const STEP_MS = 9000

/** Figma "Importing theme": the stages of an import, ticked off while the one request runs. */
export default function ImportSteps() {
  // Hooks
  const { screen } = useCopy(themeImportContent)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const last = screen.steps.length - 1
    const t = setInterval(() => setCurrent((c) => Math.min(c + 1, last)), STEP_MS)
    return () => clearInterval(t)
  }, [screen.steps.length])

  // Render logic
  return (
    <ol className="flex flex-col gap-2 text-body">
      {screen.steps.map((step, i) => (
        <li
          key={step}
          className={cn(
            'flex items-center gap-2',
            i < current
              ? 'text-foreground'
              : i === current
                ? 'text-ink-strong'
                : 'text-muted-foreground',
          )}
        >
          {i < current ? (
            <CheckIcon className="size-4 text-success" aria-hidden="true" />
          ) : i === current ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <span aria-hidden="true" className="size-4" />
          )}
          {step}
        </li>
      ))}
    </ol>
  )
}
