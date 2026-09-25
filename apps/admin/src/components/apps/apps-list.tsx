'use client'

import { Blocks, CircleAlert, Puzzle, Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
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
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { appsContent as copy } from '@/data/apps'
import { api } from '@/lib/api-client'
import { categoriesOf, filterConnections, groupApps, matchesQuery } from '@/lib/apps-gallery'
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

type SectionProps = {
  title: string
  intro: string
  apps: AppSummary[]
  busyId: string | null
  onInstall: (app: AppSummary) => void
  onUninstall: (app: AppSummary) => void
  filters?: ReactNode
  emptyBody: string
}

/** One gallery section (Built-in apps or Connections): heading, optional filter chips, grid. */
function AppsSection({
  title,
  intro,
  apps,
  busyId,
  onInstall,
  onUninstall,
  filters,
  emptyBody,
}: SectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-card-title text-ink-strong">{title}</h2>
        <p className="text-body text-muted-foreground">{intro}</p>
      </div>
      {filters}
      {apps.length === 0 ? (
        <Card>
          <EmptyState icon={Search} heading={copy.gallery.noResultsHeading} body={emptyBody} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {apps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              busy={busyId === app.id}
              onInstall={onInstall}
              onUninstall={onUninstall}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Apps: every plugin from commerce.config.ts, split into Built-in apps and Connections. */
export default function AppsList() {
  // Hooks
  const [apps, setApps] = useState<AppSummary[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingUninstall, setPendingUninstall] = useState<AppSummary | null>(null)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

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
      toast.error(describeError(err, copy.actionFailed))
    } finally {
      setBusyId(null)
    }
  }

  const handleConfirmUninstall = () => {
    const app = pendingUninstall
    setPendingUninstall(null)
    if (app) void handleToggle(app, false)
  }

  // Derived
  const { builtin, connections } = groupApps(apps ?? [])
  const builtinApps = builtin.filter((a) => matchesQuery(a, query))
  const connectionApps = filterConnections(connections, query, categoryFilter)
  const filterOptions = [
    { value: 'all', label: copy.gallery.filters.all },
    { value: 'installed', label: copy.gallery.filters.installed },
    ...categoriesOf(connections).map((value) => ({
      value,
      label: copy.gallery.categories[value] ?? value,
    })),
  ]

  return (
    <PageBody>
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        icon={<Blocks className="size-4" />}
        tone="info"
      />
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.actionFailed}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.gallery.searchPlaceholder}
          className="pl-9"
          aria-label={copy.gallery.searchPlaceholder}
        />
      </div>

      {apps === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LoadingCards />
        </div>
      ) : builtin.length === 0 && connections.length === 0 ? (
        <Card>
          <EmptyState icon={Puzzle} heading={copy.emptyHeading} body={copy.empty} />
        </Card>
      ) : (
        <>
          <AppsSection
            title={copy.gallery.builtin.title}
            intro={copy.gallery.builtin.intro}
            apps={builtinApps}
            busyId={busyId}
            onInstall={(a) => handleToggle(a, true)}
            onUninstall={setPendingUninstall}
            emptyBody={copy.gallery.noResultsBody}
          />

          <AppsSection
            title={copy.gallery.connections.title}
            intro={copy.gallery.connections.intro}
            apps={connectionApps}
            busyId={busyId}
            onInstall={(a) => handleToggle(a, true)}
            onUninstall={setPendingUninstall}
            emptyBody={copy.gallery.noResultsBody}
            filters={
              <div className="flex flex-wrap items-center gap-1.5">
                {filterOptions.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={categoryFilter === opt.value ? 'default' : 'outline'}
                    className={cn('rounded-full')}
                    onClick={() => setCategoryFilter(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            }
          />
        </>
      )}

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
