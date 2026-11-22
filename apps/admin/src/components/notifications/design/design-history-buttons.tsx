'use client'

import { Redo, Undo } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'

type DesignHistoryButtonsProps = {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

/** Undo and Redo in the editor's top bar (Ctrl+Z and Ctrl+Shift+Z do the same). */
export default function DesignHistoryButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: DesignHistoryButtonsProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)

  // Render logic
  return (
    <div className="flex items-center">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={copy.editor.undo}
        title={copy.editor.undoShortcut}
        aria-keyshortcuts="Control+Z Meta+Z"
        disabled={!canUndo}
        onClick={onUndo}
      >
        <Undo aria-hidden="true" className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={copy.editor.redo}
        title={copy.editor.redoShortcut}
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        disabled={!canRedo}
        onClick={onRedo}
      >
        <Redo aria-hidden="true" className="size-4" />
      </Button>
    </div>
  )
}
