'use client'

import { BadgePercent, Palette, ShoppingCart } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import StatusChip from '@/components/layout/status-chip'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'

export type ChangeKind = 'theme' | 'checkout' | 'discounts'

type AddChangesDialogProps = {
  open: boolean
  /** Kinds already in the rollout: each is added once. */
  added: ChangeKind[]
  /** Kinds this member cannot add (checkout without Settings access). */
  unavailable: ChangeKind[]
  onClose: () => void
  onAdd: (kind: ChangeKind) => void
}

const KINDS = [
  { kind: 'theme', icon: Palette },
  { kind: 'checkout', icon: ShoppingCart },
  { kind: 'discounts', icon: BadgePercent },
] as const

/** "Add changes": the online store theme, the checkout branding or discounts. */
export default function AddChangesDialog({
  open,
  added,
  unavailable,
  onClose,
  onAdd,
}: AddChangesDialogProps) {
  // Hooks
  const { addDialog: copy } = useCopy(rolloutsContent).form

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {KINDS.map(({ kind, icon: Icon }) => {
            const done = added.includes(kind)
            const off = done || unavailable.includes(kind)
            return (
              <li key={kind}>
                <button
                  type="button"
                  disabled={off}
                  onClick={() => onAdd(kind)}
                  className="motion-press flex w-full items-start gap-3 rounded-lg border border-border px-3 py-3 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-body font-medium text-foreground">
                      {copy[kind].label}
                      {done ? <StatusChip>{copy.added}</StatusChip> : null}
                    </span>
                    <span className="text-caption text-muted-foreground">{copy[kind].body}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {copy.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
