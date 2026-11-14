'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import type { ReactNode } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { shortcutsContent as copy } from '@/data/command-palette'
import { dialogContent } from '@/data/common'
import { useCopy } from '@/hooks/use-copy'

type KeyboardShortcutsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Another surface's shortcuts (the theme editor's); defaults to the global list. */
  title?: string
  description?: string
  children?: ReactNode
}

/**
 * The one keyboard-shortcuts dialog (audit 9e). `?` opens it with every global shortcut,
 * grouped, so nobody has to guess or memorise; the theme editor passes its own list.
 */
export default function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: KeyboardShortcutsDialogProps) {
  // Hooks
  const shared = useCopy(dialogContent)

  // Render logic
  const heading = title ?? copy.title
  const intro = title ? description : (description ?? copy.description)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          {intro ? <DialogDescription>{intro}</DialogDescription> : null}
        </DialogHeader>
        {children ?? (
          <div className="flex flex-col gap-5">
            {copy.groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-2">
                <p className="text-caption font-medium text-muted-foreground">{group.label}</p>
                <div className="flex flex-col gap-2">
                  {group.items.map((item) => (
                    <div
                      key={`${item.label}-${item.keys.join('+')}`}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-body text-foreground">{item.label}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {item.keys.map((key) => (
                          <Kbd key={key}>{key}</Kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {shared.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
