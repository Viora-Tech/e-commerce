'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { customizeContent } from '@/data/customize'
import { type CustomizeDoc, zoneSections } from '@/lib/customize-doc'
import { groupForZone, type InsertTarget } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import AddSectionBrowser from './add-section-browser'

type AddSectionDialogProps = {
  target: InsertTarget | null
  onClose: () => void
}

const copy = customizeContent.insertDialog

/**
 * The Add section browser for a "+" clicked on the canvas. A dialog in the
 * admin document rather than a popover, because the "+" lives inside the
 * preview iframe and a popover can't be anchored across that edge.
 */
export default function AddSectionDialog({ target, onClose }: AddSectionDialogProps) {
  // Hooks
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)

  // Render logic
  const count = target ? zoneSections(data, target.zone).length : 0

  return (
    <Dialog open={target !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="flex h-[min(36rem,80vh)] w-full max-w-[24rem] flex-col gap-0 p-0">
        <DialogHeader className="gap-1 border-b border-border px-4 pt-4 pb-3">
          <DialogTitle className="text-base font-medium">{copy.title}</DialogTitle>
          <DialogDescription className="text-xs">{copy.description}</DialogDescription>
        </DialogHeader>
        {target ? (
          <AddSectionBrowser
            zone={target.zone}
            group={groupForZone(target.zone)}
            index={target.index}
            count={count}
            onAdd={onClose}
            fill
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
