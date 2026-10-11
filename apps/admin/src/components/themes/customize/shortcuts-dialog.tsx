'use client'

import { KeyboardIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import ShortcutList from './shortcut-list'

type ShortcutsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The editor's keyboard shortcuts in a dialog (Figma 392:10617): a 560px card with a keyboard
 * glyph and the title, every shortcut in two columns, and Close. `?` opens it from anywhere in
 * the editor; the Help panel lists the same shortcuts.
 */
export default function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  // Hooks
  const copy = useCopy(customizeContent.help)

  // Render logic
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-3.5 p-6 sm:max-w-[35rem]">
        <DialogTitle className="flex items-center gap-2 text-[1.0625rem] leading-6 font-semibold">
          <KeyboardIcon aria-hidden weight="regular" className="size-[1.125rem] text-primary" />
          {copy.dialogTitle}
        </DialogTitle>
        <ShortcutList columns={2} />
        <DialogFooter className="mt-1 border-0 bg-transparent p-0">
          <DialogClose render={<Button variant="ghost" />}>{copy.close}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
