'use client'

import { Monitor, Smartphone, Tablet } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import SettingsPageHeader from '@/components/settings/settings-page-header'
import { accountContent } from '@/data/account'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { deviceName, devicePlace } from '@/lib/device-label'
import ConfirmDialog from './confirm-dialog'

type MemberSession = Awaited<ReturnType<typeof api.account.sessions>>[number]

const KIND_ICON = { phone: Smartphone, tablet: Tablet, computer: Monitor } as const

/**
 * Account → Sessions: every browser signed in as this member, this one first, with "Sign out"
 * per device and "Sign out everywhere else". Each asks first.
 */
export default function SessionsPage() {
  // Hooks
  const content = useCopy(accountContent)
  const fmt = useFormat()
  const [sessions, setSessions] = useState<MemberSession[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  const [target, setTarget] = useState<MemberSession | null>(null)
  const [othersOpen, setOthersOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-runs the load after a change
  useEffect(() => {
    api.account
      .sessions()
      .then(setSessions)
      .catch(() => setFailed(true))
  }, [version])

  // Helpers
  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await action()
      toast.success(done)
      setTarget(null)
      setOthersOpen(false)
      setVersion((n) => n + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : content.sessions.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleSignOut = () => {
    if (target) {
      run(() => api.account.revokeSession({ id: target.id }), content.sessions.signedOut)
    }
  }

  const handleSignOutOthers = () =>
    run(() => api.account.revokeOtherSessions(), content.sessions.othersSignedOut)

  const handleRetry = () => {
    setFailed(false)
    setVersion((n) => n + 1)
  }

  // Early returns
  const copy = content.sessions
  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        <SettingsPageHeader title={copy.title} hideBack />
        <Card gap={3} inset={6} className="items-start">
          <p className="text-body text-muted-foreground">{copy.loadFailed}</p>
          <Button variant="outline" onClick={handleRetry}>
            {copy.retry}
          </Button>
        </Card>
      </div>
    )
  }

  // Render logic
  const others = sessions?.filter((s) => !s.current).length ?? 0

  return (
    <div className="flex flex-col gap-4">
      <SettingsPageHeader
        title={copy.title}
        subtitle={sessions ? copy.intro(sessions.length) : undefined}
        hideBack
        actions={
          others > 0 ? (
            <Button variant="outline" onClick={() => setOthersOpen(true)}>
              {copy.signOutOthers}
            </Button>
          ) : null
        }
      />
      <SettingsCard title={copy.heading} description={copy.body}>
        {sessions === null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {sessions.map((s) => {
              const Icon = KIND_ICON[s.device.kind]
              const place = devicePlace(s, content)
              const meta = [
                place,
                // devicePlace already falls back to the IP when the city is unknown.
                s.ipMasked && !place.includes(s.ipMasked) ? content.device.ip(s.ipMasked) : null,
                copy.signedIn(fmt.when(s.signedInAt)),
                s.current ? copy.activeNow : copy.lastActive(fmt.when(s.lastActiveAt)),
              ].filter(Boolean)
              return (
                <li key={s.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Icon aria-hidden="true" className="size-6 shrink-0 text-ink-strong" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-body font-medium text-ink-strong">
                          {deviceName(s.device, content)}
                        </span>
                        {s.current ? <StatusChip>{copy.thisDevice}</StatusChip> : null}
                      </div>
                      <span className="truncate text-caption text-muted-foreground">
                        {meta.join(' · ')}
                      </span>
                    </div>
                  </div>
                  {s.current ? null : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-start sm:self-auto"
                      onClick={() => setTarget(s)}
                    >
                      {copy.signOut}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-4 text-caption text-muted-foreground">
          {others === 0 && sessions ? `${copy.onlyThis} ` : ''}
          {copy.note}
        </p>
      </SettingsCard>
      <ConfirmDialog
        open={target !== null}
        title={copy.signOutDialog.title(target ? deviceName(target.device, content) : '')}
        body={copy.signOutDialog.body}
        confirmLabel={copy.signOutDialog.confirm}
        cancelLabel={copy.signOutDialog.cancel}
        busy={busy}
        onOpenChange={(open) => !open && !busy && setTarget(null)}
        onConfirm={handleSignOut}
      />
      <ConfirmDialog
        open={othersOpen}
        title={copy.othersDialog.title}
        body={copy.othersDialog.body}
        confirmLabel={copy.othersDialog.confirm}
        cancelLabel={copy.othersDialog.cancel}
        busy={busy}
        onOpenChange={(open) => !busy && setOthersOpen(open)}
        onConfirm={handleSignOutOthers}
      />
    </div>
  )
}
