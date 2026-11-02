import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import { shortcutsContent as copy } from '@/data/command-palette'

type KeyboardShortcutsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** `?` opens this: every global shortcut, grouped, so nobody has to guess or memorise. */
export default function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  )
}
