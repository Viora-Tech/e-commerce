'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import type { ReactNode } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy } from '@/hooks/use-copy'

type ConnectStepsProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  intro?: string
  /** Every step's short name, in order. */
  steps: readonly string[]
  at: number
  onBack: () => void
  onNext: () => void
  /** The last step's button. */
  submitLabel: string
  busy?: boolean
  nextDisabled?: boolean
  children: ReactNode
}

/**
 * Figma "Connect" dialog: one step at a time under a segmented progress bar, Back on the
 * left of the primary button. The caller owns the step and what each one shows.
 */
export default function ConnectSteps({
  open,
  onOpenChange,
  title,
  intro,
  steps,
  at,
  onBack,
  onNext,
  submitLabel,
  busy = false,
  nextDisabled = false,
  children,
}: ConnectStepsProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.connect)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return
    onOpenChange(next)
  }

  // Render logic
  const last = at === steps.length - 1
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {intro ? <DialogDescription>{intro}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <p className="text-caption text-muted-foreground">
            {copy.step(at + 1, steps.length, steps[at] ?? '')}
          </p>
          <div className="flex gap-1" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s}
                className={cn('h-1 flex-1 rounded-full', i <= at ? 'bg-action' : 'bg-muted')}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">{children}</div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={at === 0 ? () => onOpenChange(false) : onBack}
          >
            {at === 0 ? copy.cancel : copy.back}
          </Button>
          <Button type="button" loading={busy} disabled={nextDisabled} onClick={onNext}>
            {last ? submitLabel : copy.next}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
