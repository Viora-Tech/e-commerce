'use client'

import KeyboardShortcutsDialog from '@/components/layout/keyboard-shortcuts-dialog'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import ShortcutList from './shortcut-list'

type ShortcutsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The editor's keyboard shortcuts (Figma 392:10617), in the one shortcuts dialog
 * (`layout/keyboard-shortcuts-dialog`): every editor shortcut in two columns, and Close. `?`
 * opens it from anywhere in the editor; the Help panel lists the same shortcuts.
 */
export default function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  // Hooks
  const copy = useCopy(customizeContent.help)

  return (
    <KeyboardShortcutsDialog open={open} onOpenChange={onOpenChange} title={copy.dialogTitle}>
      <ShortcutList columns={2} />
    </KeyboardShortcutsDialog>
  )
}
