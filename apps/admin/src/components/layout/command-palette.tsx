'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { paletteContent } from '@/data/command-palette'
import { useCopy } from '@/hooks/use-copy'
import PaletteBody from './palette-body'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The one search (⌘K, "/", the header search): a wide glass dialog. The dialog's own open and
 * close motion applies (150–200 ms, none under reduced motion); the contents mount only while
 * it is open, so each open starts on an empty search.
 */
export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  // Hooks
  const copy = useCopy(paletteContent)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        showCloseButton={false}
        className="glass-popover top-[10vh] translate-y-0 gap-0 overflow-hidden rounded-2xl! bg-glass-popover p-0 sm:max-w-[40rem]"
      >
        <PaletteBody onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
