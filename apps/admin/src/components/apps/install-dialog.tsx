'use client'

import { CheckIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { permissionLines } from '@/lib/app-permissions'
import type { AppSummary } from './app-card'
import AppLogo from './app-logo'

type InstallDialogProps = {
  /** The app being installed; null keeps the dialog closed. */
  app: AppSummary | null
  busy: boolean
  onConfirm: (app: AppSummary) => void
  onCancel: () => void
}

/** The permission step before an install: what the app's manifest says it does, in plain words. */
export default function InstallDialog({ app, busy, onConfirm, onCancel }: InstallDialogProps) {
  // Hooks
  const copy = useCopy(appsContent)

  // Render logic
  const lines = app ? permissionLines(app, copy) : []

  return (
    <Dialog open={app !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        {app ? (
          <>
            <DialogHeader>
              <div className="mb-1 flex items-center gap-3">
                <AppLogo id={app.id} icon={app.admin.icon} size={48} />
                <DialogTitle>{copy.permissions.title(app.name)}</DialogTitle>
              </div>
              <DialogDescription>{copy.permissions.intro}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <p className="text-body font-medium text-foreground">{copy.permissions.heading}</p>
              <ul className="flex flex-col gap-2">
                {lines.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-body text-muted-foreground">
                    <CheckIcon
                      className="mt-0.5 size-4 shrink-0 text-foreground"
                      aria-hidden="true"
                    />
                    {line}
                  </li>
                ))}
              </ul>
              <p className="pt-1 text-caption text-muted-foreground">
                {copy.permissions.nothingElse}
                {app.credits.length > 0
                  ? ` ${copy.permissions.credits(app.credits.map((c) => c.name).join(', '))}.`
                  : ''}
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onCancel}>
                {copy.permissions.cancel}
              </Button>
              <Button loading={busy} onClick={() => onConfirm(app)}>
                {copy.permissions.confirm}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
