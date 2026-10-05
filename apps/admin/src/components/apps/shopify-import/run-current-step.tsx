'use client'

import { IMPORT_RESOURCES } from '@commerce/plugin-shopify-import/client'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import type { RunDetail } from './types'

type RunCurrentStepProps = { run: RunDetail }

/** The step the run is on: the first type still counting up, else the last one started. */
function currentStep(run: RunDetail) {
  const started = IMPORT_RESOURCES.filter((r) => run.resources.includes(r) && run.progress[r])
  const busy = started.find((r) => {
    const p = run.progress[r]
    return p ? p.processed < p.total || p.total === 0 : false
  })
  const resource = busy ?? started.at(-1)
  const p = resource ? run.progress[resource] : undefined
  return resource && p ? { resource, done: p.processed, total: p.total } : null
}

/** "Files: 1,240 of 2,300" with a bar, while a run is going. */
export default function RunCurrentStep({ run }: RunCurrentStepProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const resources = useCopy(shopifyImportContent.resources)

  // Early returns
  const step = run.status === 'running' ? currentStep(run) : null
  if (!step) return null

  // Render logic
  const share = step.total > 0 ? Math.min(1, step.done / step.total) : 0

  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-body font-medium text-ink-strong tabular-nums">
        {copy.now(resources[step.resource], step.done, step.total)}
      </span>
      <span
        className="block h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={step.total}
        aria-valuenow={step.done}
      >
        <span
          className="block h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-linear motion-reduce:transition-none"
          style={{ transform: `scaleX(${share})` }}
        />
      </span>
    </div>
  )
}
