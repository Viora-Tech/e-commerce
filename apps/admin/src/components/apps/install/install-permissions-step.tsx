'use client'

import { CircleCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { DialogDescription, DialogFooter, DialogTitle } from '@commerce/ui/shadcn/dialog'
import AppAccessList from '@/components/apps/app-access-list'
import type { AppSummary } from '@/components/apps/app-card'
import { appInstallContent } from '@/data/app-install'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { permissionLines } from '@/lib/app-permissions'

type InstallPermissionsStepProps = {
  app: AppSummary
  /** The passing test from step 1, shown as a green line ("Connected — Delhivery serves 122001."). */
  connected: string | null
  busy: boolean
  /** Null when there is no step to go back to. */
  onBack: (() => void) | null
  onCancel: () => void
  onInstall: () => void
}

/** Step 2, "Permissions" (Figma "Connect step 2 — permissions"): what the app will do and reach, then Install. */
export default function InstallPermissionsStep({
  app,
  connected,
  busy,
  onBack,
  onCancel,
  onInstall,
}: InstallPermissionsStepProps) {
  // Hooks
  const copy = useCopy(appInstallContent)
  const apps = useCopy(appsContent)

  // Render logic
  const lines = permissionLines(app, apps)

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <DialogTitle>{copy.permissions.title(app.name)}</DialogTitle>
        <DialogDescription>{copy.permissions.intro}</DialogDescription>
      </div>
      {connected ? (
        <p className="flex items-center gap-2 rounded-[0.625rem] bg-success-soft px-3 py-2.5 text-body text-success">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          {connected}
        </p>
      ) : null}
      {lines.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-body font-medium text-foreground">{copy.permissions.heading}</p>
          <ul className="flex flex-col gap-2">
            {lines.map((line) => (
              <li key={line} className="flex items-start gap-2 text-body text-foreground">
                <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {app.access.resources.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-body font-medium text-foreground">{copy.permissions.access}</p>
          <AppAccessList app={app} />
        </div>
      ) : null}
      <p className="text-caption text-muted-foreground">{apps.permissions.nothingElse}</p>
      <DialogFooter>
        <Button variant="outline" onClick={onBack ?? onCancel}>
          {onBack ? copy.permissions.back : copy.permissions.cancel}
        </Button>
        <Button loading={busy} onClick={onInstall}>
          {copy.permissions.install}
        </Button>
      </DialogFooter>
    </>
  )
}
