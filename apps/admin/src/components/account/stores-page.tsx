'use client'

import { ArrowLeftRight, LogOut, RotateCcw, Store } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { accountContent } from '@/data/account'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { authClient } from '@/lib/auth-client'
import { routes } from '@/lib/routes'

type MemberStore = Awaited<ReturnType<typeof api.account.stores>>[number]

/**
 * Account → Stores: every store the member works in, their role, the one open now, a
 * "Switch to" for the others and "Leave" for any store they do not own.
 */
export default function StoresPage() {
  // Hooks
  const { stores: copy } = useCopy(accountContent)
  const fmt = useFormat()
  const router = useRouter()
  const [stores, setStores] = useState<MemberStore[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<MemberStore | null>(null)
  const [busy, setBusy] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-runs the load after a change
  useEffect(() => {
    api.account
      .stores()
      .then(setStores)
      .catch(() => setFailed(true))
  }, [version])

  // Event handlers
  const handleSwitch = async (organizationId: string) => {
    if (switchingId) return
    setSwitchingId(organizationId)
    try {
      const { error } = await authClient.organization.setActive({ organizationId })
      if (error) throw new Error(error.message ?? copy.switchFailed)
      // A full load, so client caches (permissions, lists) start fresh for the new store.
      window.location.assign(routes.home())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.switchFailed)
      setSwitchingId(null)
    }
  }

  const handleLeave = async () => {
    if (!leaving) return
    setBusy(true)
    try {
      const { wasActive } = await api.account.leaveStore({
        organizationId: leaving.organizationId,
      })
      toast.success(copy.leaveDialog.done(leaving.name))
      await authClient.getSession({ query: { disableCookieCache: true } })
      if (wasActive || (stores?.length ?? 0) <= 1) {
        // No store open any more: home picks the next one, or offers to create one.
        window.location.assign(routes.home())
        return
      }
      setLeaving(null)
      setVersion((n) => n + 1)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.leaveDialog.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDialogChange = (open: boolean) => {
    if (!open && !busy) setLeaving(null)
  }

  const handleRetry = () => {
    setFailed(false)
    setVersion((n) => n + 1)
  }

  // Early returns
  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={copy.title} />
        <Card gap={3} inset={6} className="items-start">
          <p className="text-body text-muted-foreground">{copy.loadFailed}</p>
          <Button variant="outline" onClick={handleRetry}>
            <RotateCcw aria-hidden="true" />
            {copy.retry}
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={stores ? copy.intro(stores.length) : undefined} />
      <SettingsCard title={copy.heading} description={copy.body}>
        {stores === null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ul className="flex flex-col">
            {stores.map((s) => (
              <li
                key={s.organizationId}
                className="flex flex-col gap-3 border-b border-hairline py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-[0.625rem] border border-hairline bg-muted text-muted-foreground"
                  >
                    <Store className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-body font-semibold text-ink-strong">
                        {s.name}
                      </span>
                      {s.active ? <StatusChip>{copy.current}</StatusChip> : null}
                    </div>
                    <span className="truncate text-caption text-muted-foreground">
                      {s.isOwner ? copy.owner : (s.roleName ?? copy.noRole)}
                      {' · '}
                      {copy.joined(fmt.date(s.joinedAt))}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {s.isOwner ? null : (
                    <Button variant="ghost" size="sm" onClick={() => setLeaving(s)}>
                      <LogOut aria-hidden="true" />
                      {copy.leave}
                    </Button>
                  )}
                  {s.active ? null : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSwitch(s.organizationId)}
                      loading={switchingId === s.organizationId}
                      disabled={switchingId !== null}
                    >
                      <ArrowLeftRight aria-hidden="true" />
                      {copy.switchTo}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
      {stores?.some((s) => s.isOwner) ? (
        <p className="px-1 text-caption text-muted-foreground">{copy.ownerCannotLeave}</p>
      ) : null}
      <ConfirmDialog
        tone="destructive"
        open={leaving !== null}
        title={copy.leaveDialog.title(leaving?.name ?? '')}
        body={
          (stores?.length ?? 0) <= 1
            ? `${copy.leaveDialog.body} ${copy.leaveDialog.lastStore}`
            : copy.leaveDialog.body
        }
        confirmLabel={copy.leaveDialog.confirm}
        cancelLabel={copy.leaveDialog.cancel}
        busy={busy}
        onOpenChange={handleDialogChange}
        onConfirm={handleLeave}
      />
    </div>
  )
}
