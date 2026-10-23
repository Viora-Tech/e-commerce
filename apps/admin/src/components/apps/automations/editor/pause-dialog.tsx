'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'

type PauseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Runs parked on a wait or an approval. */
  openRuns: number
  busy: boolean
  onPause: (waitingRuns: 'cancel' | 'finish') => void
}

/** Pausing asks what happens to waiting runs: let them finish, or cancel them. */
export default function PauseDialog({
  open,
  onOpenChange,
  openRuns,
  busy,
  onPause,
}: PauseDialogProps) {
  // Hooks
  const { pause: copy } = useCopy(automationEditorContent)

  // Render logic
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body(openRuns)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {openRuns > 0 ? (
            <>
              <Button variant="outline" disabled={busy} onClick={() => onPause('cancel')}>
                {copy.cancel}
              </Button>
              <Button disabled={busy} onClick={() => onPause('finish')}>
                {copy.finish}
              </Button>
            </>
          ) : (
            <Button disabled={busy} onClick={() => onPause('finish')}>
              {copy.confirm}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
