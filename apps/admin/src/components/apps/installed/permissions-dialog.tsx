'use client'

import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import type { ReactNode } from 'react'
import AppAccessList from '@/components/apps/app-access-list'
import AppLogo from '@/components/apps/app-logo'
import RelativeTime from '@/components/layout/relative-time'
import { installedAppsContent } from '@/data/installed-apps'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { credentialKinds } from '@/lib/app-access'
import type { AppSummary } from '@/lib/app-summary'

type PermissionsDialogProps = {
  /** The app whose access is open; null closes the dialog. */
  app: AppSummary | null
  storeName: string | null
  byline: (app: AppSummary) => string
  onClose: () => void
  onRemove: (app: AppSummary) => void
}

const SECTION = 'text-caption font-medium tracking-wide text-muted-foreground uppercase'

/** Figma "Installed apps · App permissions": what an installed app can reach, what it sends out, its history. */
export default function PermissionsDialog({
  app,
  storeName,
  byline,
  onClose,
  onRemove,
}: PermissionsDialogProps) {
  // Hooks
  const copy = useCopy(installedAppsContent)
  const fmt = useFormat()

  // Render logic
  const kinds = app ? credentialKinds(app) : []
  const credentials =
    app && app.kind === 'connection' && kinds.length > 0
      ? kinds.map((k) => copy.sheet.where[k]).join(', ')
      : null

  return (
    <Dialog open={app !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-[30rem]">
        {app ? (
          <>
            <DialogHeader className="gap-0.5 p-4 pr-12">
              <DialogTitle>{copy.sheet.title(app.name)}</DialogTitle>
              <DialogDescription>
                {storeName ? copy.sheet.intro(storeName) : copy.sheet.introNoStore}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
              <div className="flex items-center gap-3">
                <AppLogo id={app.id} icon={app.admin.icon} size={48} />
                <div className="flex min-w-0 flex-col">
                  <span className="text-body font-semibold text-foreground">{app.name}</span>
                  <span className="text-caption text-muted-foreground">
                    {[
                      byline(app),
                      app.kind === 'connection'
                        ? copy.sheet.typeConnection
                        : copy.sheet.typeBuiltin,
                      copy.sheet.version(app.version),
                    ].join(' · ')}
                  </span>
                </div>
              </div>

              <section className="flex flex-col gap-1">
                <h3 className={SECTION}>{copy.sheet.canAccess}</h3>
                <AppAccessList app={app} />
                <p className="text-body text-muted-foreground">{copy.sheet.nothingElse}</p>
              </section>

              {app.access.shares.length > 0 || credentials ? (
                <section className="flex flex-col gap-1">
                  <h3 className={SECTION}>{copy.sheet.shared(app.company ?? app.name)}</h3>
                  <ul className="flex flex-col">
                    {app.access.shares.map((s) => (
                      <Row key={s.when} label={s.when}>
                        {s.what}
                      </Row>
                    ))}
                    {credentials ? (
                      <Row label={copy.sheet.savedCredentials} end={copy.sheet.encrypted}>
                        {copy.sheet.credentialsWhere(app.name, credentials)}
                      </Row>
                    ) : null}
                  </ul>
                </section>
              ) : null}

              <section className="flex flex-col gap-1">
                <h3 className={SECTION}>{copy.sheet.history}</h3>
                <ul className="flex flex-col">
                  <Row
                    label={copy.sheet.installed}
                    end={app.installedAt ? fmt.date(app.installedAt) : '—'}
                  >
                    {app.installedAt
                      ? app.installedBy
                        ? copy.sheet.installedBy(app.installedBy)
                        : ''
                      : copy.unknownDate}
                  </Row>
                  <Row
                    label={copy.sheet.lastUsed}
                    end={app.lastActivityAt ? <RelativeTime value={app.lastActivityAt} /> : null}
                  >
                    {app.lastActivityAt
                      ? (app.lastActivity ?? copy.activity.generic)
                      : copy.sheet.notUsed}
                  </Row>
                  {app.problem ? (
                    <Row label={copy.sheet.problem}>
                      <span className="text-destructive">{app.problem}</span>
                    </Row>
                  ) : null}
                </ul>
                <p className="text-body text-muted-foreground">{copy.sheet.removeAnyTime}</p>
              </section>
            </div>
            <DialogFooter className="m-0 flex-row justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                {copy.sheet.close}
              </Button>
              <Button variant="destructive" onClick={() => onRemove(app)}>
                <Trash2 aria-hidden="true" />
                {copy.sheet.remove}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

type RowProps = { label: string; end?: ReactNode; children: ReactNode }

/** One labelled line of the dialog: label, the detail, and an optional value on the right. */
function Row({ label, end, children }: RowProps) {
  return (
    <li className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_auto] items-center gap-3 py-2">
      <span className="text-body font-medium text-foreground">{label}</span>
      <span className="text-body text-muted-foreground">{children}</span>
      {end ? (
        <span className="text-right text-body whitespace-nowrap text-foreground">{end}</span>
      ) : (
        <span />
      )}
    </li>
  )
}
