'use client'

import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { CircleAlert, Puzzle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { appsContent as copy } from '@/data/apps'
import { api } from '@/lib/api-client'
import AppCard, { type AppSummary } from './app-card'

function describeError(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

function LoadingCards() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="gap-4 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-6 w-32" />
        </Card>
      ))}
    </>
  )
}

/** Apps: every plugin from commerce.config.ts, installable per store. */
export default function AppsList() {
  // Hooks
  const [apps, setApps] = useState<AppSummary[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingUninstall, setPendingUninstall] = useState<AppSummary | null>(null)
  useEffect(() => {
    api.apps
      .list()
      .then(setApps)
      .catch((err) => setError(describeError(err, copy.loadFailed)))
  }, [])

  // Event handlers
  const handleToggle = async (app: AppSummary, install: boolean) => {
    setBusyId(app.id)
    setError(null)
    try {
      if (install) await api.apps.install({ id: app.id })
      else await api.apps.uninstall({ id: app.id })
      setApps(await api.apps.list())
      toast.success(install ? copy.installedToast(app.name) : copy.uninstalledToast(app.name))
    } catch (err) {
      setError(describeError(err, copy.actionFailed))
    } finally {
      setBusyId(null)
    }
  }

  const handleConfirmUninstall = () => {
    const app = pendingUninstall
    setPendingUninstall(null)
    if (app) void handleToggle(app, false)
  }

  return (
    <PageBody>
      <PageHeader title={copy.title} subtitle={copy.intro} />
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.actionFailed}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {apps === null ? (
          <LoadingCards />
        ) : apps.length === 0 ? (
          <Card className="md:col-span-2">
            <EmptyState icon={Puzzle} heading={copy.emptyHeading} body={copy.empty} />
          </Card>
        ) : (
          apps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              busy={busyId === app.id}
              onInstall={(a) => handleToggle(a, true)}
              onUninstall={setPendingUninstall}
            />
          ))
        )}
      </div>
      <p className="text-caption text-muted-foreground-soft">{copy.docs}</p>

      <AlertDialog
        open={pendingUninstall !== null}
        onOpenChange={(open) => !open && setPendingUninstall(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {copy.confirmUninstall.title(pendingUninstall?.name ?? '')}
            </AlertDialogTitle>
            <AlertDialogDescription>{copy.confirmUninstall.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.confirmUninstall.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUninstall}>
              {copy.confirmUninstall.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  )
}
