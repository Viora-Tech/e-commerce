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

/** Apps with their own admin screens; provider-only plugins (a gateway, a courier) are Built in. */
function hasScreens(app: AppSummary): boolean {
  return app.admin.pages.length > 0
}

function matches(app: AppSummary, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    app.name.toLowerCase().includes(needle) ||
    (app.description ?? '').toLowerCase().includes(needle)
  )
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

/** Apps: every plugin from commerce.config.ts, as an installable gallery. */
export default function AppsList() {
  // Hooks
  const [apps, setApps] = useState<AppSummary[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingUninstall, setPendingUninstall] = useState<AppSummary | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string>('all')

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

  // Render logic
  const gallery = (apps ?? []).filter((a) => !a.builtIn && hasScreens(a))
  const builtIn = (apps ?? []).filter((a) => a.builtIn || !hasScreens(a))
  const categories = [
    ...new Map(
      gallery.flatMap((a) =>
        a.category
          ? [[a.category, copy.gallery.categories[a.category] ?? a.category] as const]
          : [],
      ),
    ).entries(),
  ]
  const filtered = gallery.filter((a) => {
    if (!matches(a, query)) return false
    if (filter === 'all') return true
    if (filter === 'installed') return a.installed
    return a.category === filter
  })
  const filterOptions = [
    { value: 'all', label: copy.gallery.filters.all },
    { value: 'installed', label: copy.gallery.filters.installed },
    ...categories.map(([value, label]) => ({ value, label })),
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterOptions.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={filter === opt.value ? 'default' : 'outline'}
              className={cn('rounded-full')}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
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
      </div>

      {apps === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LoadingCards />
        </div>
      ) : gallery.length === 0 ? (
        <Card>
          <EmptyState icon={Puzzle} heading={copy.emptyHeading} body={copy.empty} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            heading={copy.gallery.noResultsHeading}
            body={copy.gallery.noResultsBody}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              busy={busyId === app.id}
              onInstall={(a) => handleToggle(a, true)}
              onUninstall={setPendingUninstall}
            />
          ))}
        </div>
      )}

      {builtIn.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-card-title text-ink-strong">{copy.gallery.builtInTitle}</h2>
            <p className="text-body text-muted-foreground">{copy.gallery.builtInIntro}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {builtIn.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                busy={busyId === app.id}
                onInstall={(a) => handleToggle(a, true)}
                onUninstall={setPendingUninstall}
              />
            ))}
          </div>
        </div>
      ) : null}

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
