'use client'

import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { groupForZone, type InsertTarget } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import { zoneItems } from '@/lib/customize-slots'
import AddSectionBrowser from './add-section-browser'

type AddSectionDialogProps = {
  target: InsertTarget | null
  onClose: () => void
}

/**
 * The Add section browser for a "+" clicked on the canvas. A dialog in the
 * admin document rather than a popover, because the "+" lives inside the
 * preview iframe and a popover can't be anchored across that edge.
 */
export default function AddSectionDialog({ target, onClose }: AddSectionDialogProps) {
  // Hooks
  const copy = useCopy(customizeContent.insertDialog)
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)

  // Render logic
  const count = target ? zoneItems(data, target.zone).length : 0

  return (
    <Dialog open={target !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      {/* A narrow list (24rem from `sm` up); on phones the shell keeps its 1rem gutter. */}
      <DialogContent panel className="h-[min(36rem,80svh)] sm:max-w-[24rem]">
        <DialogHeader className="border-b">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
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
