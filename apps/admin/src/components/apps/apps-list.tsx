'use client'

import { siteConfig } from '@commerce/config/site'
import { CircleAlert, Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import InlineState from '@/components/states/inline-state'
import { appsContent } from '@/data/apps'
import { installedAppsContent } from '@/data/installed-apps'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { categoriesOf, groupApps, matchesQuery } from '@/lib/apps-gallery'
import { recommendedApps } from '@/lib/apps-recommended'
import { routes } from '@/lib/routes'
import AppCard, { type AppSummary } from './app-card'
import AppsHero from './apps-hero'
import AppsLoading from './apps-loading'
import AppsRecommended from './apps-recommended'
import InstallFlow from './install/install-flow'

const HERO_LIMIT = 4
type StatusFilter = 'all' | 'installed' | 'notInstalled'
const STATUS_FILTERS: StatusFilter[] = ['all', 'installed', 'notInstalled']
const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'

function describeError(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

/**
 * The admin's App Store (Figma "Apps / Apps home" without its Installed strip, which is now the
 * Installed apps page): featured banner, recommendations, then every app by category. Install
 * opens the install flow.
 */
export default function AppsList() {
  // Hooks
  const copy = useCopy(appsContent)
  const installedCopy = useCopy(installedAppsContent)
  const router = useRouter()
  const [apps, setApps] = useState<AppSummary[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)
  const [pendingUninstall, setPendingUninstall] = useState<AppSummary | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [builtOnly, setBuiltOnly] = useState(false)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [storeName, setStoreName] = useState<string | null>(null)

  useEffect(() => {
    api.apps
      .list()
      .then(setApps)
      .catch((err) => setError(describeError(err, appsContent.loadFailed)))
    api.store
      .current()
      .then((s) => setStoreName(s?.name ?? null))
      .catch(() => setStoreName(null))
  }, [])

  // Helpers
  // The sidebar's app links come from the server layout; re-render it so the app shows up
  // (or goes) under Apps without a manual reload.
  const reload = async () => {
    setApps(await api.apps.list())
    router.refresh()
  }

  // Event handlers
  const handleInstall = (app: AppSummary) => setInstalling(app.id)

  const handleUninstall = async () => {
    const app = pendingUninstall
    if (!app) return
    setBusyId(app.id)
    setError(null)
    try {
      await api.apps.uninstall({ id: app.id })
      await reload()
      toast.success(copy.uninstalledToast(app.name))
    } catch (err) {
      toast.error(describeError(err, copy.actionFailed))
    } finally {
      setBusyId(null)
      setPendingUninstall(null)
    }
  }

  // Render logic
  const { builtin, connections } = groupApps(apps ?? [])
  const all = [...builtin, ...connections]
  const available = all.filter((a) => !a.installed)
  const recommended = recommendedApps(all)
  const store = all.filter(
    (a) =>
      matchesQuery(a, query) &&
      (status === 'all' || (status === 'installed') === a.installed) &&
      (category === null || a.category === category) &&
      (!builtOnly || a.kind === 'builtin'),
  )
  const categoryRows = [
    { value: null, label: copy.store.all, count: all.length },
    ...categoriesOf(all).map((value) => ({
      value,
      label: copy.gallery.categories[value] ?? copy.gallery.categoryFallback(value),
      count: all.filter((a) => a.category === value).length,
    })),
  ]
  const builtCount = all.filter((a) => a.kind === 'builtin').length

  return (
    <PageBody className="gap-8">
      <PageHeader
        title={copy.sections.store.title}
        subtitle={copy.sections.store.intro(siteConfig.brand.name)}
        back={{ label: installedCopy.title, href: routes.apps.list() }}
      />
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.actionFailed}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {apps === null ? (
        <div className={GRID}>
          <AppsLoading count={6} />
        </div>
      ) : all.length === 0 ? (
        <InlineState kind="empty" heading={copy.emptyHeading} body={copy.empty} />
      ) : (
        <>
          <AppsHero
            apps={available.slice(0, HERO_LIMIT)}
            busyId={busyId}
            onInstall={handleInstall}
          />

          {storeName ? (
            <AppsRecommended
              apps={recommended}
              storeName={storeName}
              busyId={busyId}
              onInstall={handleInstall}
            />
          ) : null}

          <section id="app-store" className="flex scroll-mt-6 flex-col gap-3.5">
            <div className="flex flex-col gap-6 lg:flex-row">
              <nav
                aria-label={copy.store.categories}
                className="flex shrink-0 flex-wrap gap-1 lg:w-50 lg:flex-col"
              >
                {categoryRows.map((row) => (
                  <button
                    key={row.value ?? 'all'}
                    type="button"
                    aria-current={category === row.value}
                    onClick={() => setCategory(row.value)}
                    className={cn(
                      'flex h-[2.125rem] items-center justify-between gap-3 rounded-[0.625rem] px-2.5 text-body transition-colors',
                      category === row.value
                        ? 'bg-primary-soft font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {row.label}
                    <span className="text-caption">{row.count}</span>
                  </button>
                ))}
              </nav>
              <div className="flex min-w-0 flex-1 flex-col gap-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-full sm:w-70">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={copy.gallery.searchPlaceholder}
                      className="pl-9"
                      aria-label={copy.gallery.searchPlaceholder}
                    />
                  </div>
                  <div className="flex gap-1.5">
                    {STATUS_FILTERS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={status === value}
                        onClick={() => setStatus(value)}
                        className={cn(
                          'flex h-9 items-center rounded-full border px-3.5 text-body transition-colors',
                          status === value
                            ? 'border-primary bg-primary-soft font-medium text-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {copy.store.statusFilters[value]}
                      </button>
                    ))}
                  </div>
                  {builtCount > 0 ? (
                    <button
                      type="button"
                      aria-pressed={builtOnly}
                      onClick={() => setBuiltOnly(!builtOnly)}
                      className={cn(
                        'flex h-9 items-center gap-2 rounded-full border px-3.5 text-body transition-colors',
                        builtOnly
                          ? 'border-primary bg-primary-soft font-medium text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {copy.store.builtBy(siteConfig.brand.name)}
                      <span className="text-caption">{builtCount}</span>
                    </button>
                  ) : null}
                </div>
                {store.length === 0 ? (
                  <InlineState
                    kind="empty"
                    heading={copy.gallery.noResultsHeading}
                    body={copy.gallery.noResultsBody}
                  />
                ) : (
                  <div className={GRID}>
                    {store.map((app) => (
                      <AppCard
                        key={app.id}
                        app={app}
                        variant="store"
                        busy={busyId === app.id}
                        onInstall={handleInstall}
                        onUninstall={setPendingUninstall}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      <p className="text-caption text-muted-foreground-soft">{copy.docs}</p>

      <InstallFlow
        appId={installing}
        apps={apps}
        onClose={() => setInstalling(null)}
        onInstalled={() => void reload()}
      />

      <ConfirmDialog
        open={pendingUninstall !== null}
        onOpenChange={(open) => !open && setPendingUninstall(null)}
        title={copy.confirmUninstall.title(pendingUninstall?.name ?? '')}
        body={copy.confirmUninstall.body}
        confirmLabel={copy.confirmUninstall.confirm}
        cancelLabel={copy.confirmUninstall.cancel}
        tone="default"
        onConfirm={handleUninstall}
      />
    </PageBody>
  )
}
