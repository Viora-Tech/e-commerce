'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { DialogDescription, DialogFooter, DialogTitle } from '@commerce/ui/shadcn/dialog'
import Link from 'next/link'
import type { AppSummary } from '@/components/apps/app-card'
import AppLogo from '@/components/apps/app-logo'
import StatusChip from '@/components/layout/status-chip'
import { appInstallContent } from '@/data/app-install'
import { installedAppsContent } from '@/data/installed-apps'
import { useCopy } from '@/hooks/use-copy'
import { connectHref, openHref, STATUS_TONE } from '@/lib/app-access'

type InstallDoneStepProps = {
  /** The app as the list reads it after the install, so its status is the real one. */
  app: AppSummary
  onClose: () => void
}

/** Step 3, "Done" (Figma "Connect step 3 — done"): the app's status and where to go next. */
export default function InstallDoneStep({ app, onClose }: InstallDoneStepProps) {
  // Hooks
  const copy = useCopy(appInstallContent)
  const installed = useCopy(installedAppsContent)

  // Render logic
  const needsSetup = app.status === 'needsSetup'
  const next = needsSetup ? connectHref(app) : openHref(app)
  const intro = needsSetup
    ? copy.done.needsSetup
    : app.kind === 'connection'
      ? copy.done.connected
      : copy.done.builtin

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <DialogTitle>{copy.done.title(app.name)}</DialogTitle>
        <DialogDescription>{intro}</DialogDescription>
      </div>
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <AppLogo id={app.id} icon={app.admin.icon} size={72} />
        {app.status ? (
          <StatusChip tone={STATUS_TONE[app.status]}>{installed.status[app.status]}</StatusChip>
        ) : null}
        {app.description ? (
          <p className="max-w-[26rem] text-body text-muted-foreground">{app.description}</p>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {copy.done.close}
        </Button>
        {next ? (
          <Button nativeButton={false} render={<Link href={next} />}>
            {needsSetup ? copy.done.connect : copy.done.openApp}
          </Button>
        ) : null}
      </DialogFooter>
    </>
  )
}
