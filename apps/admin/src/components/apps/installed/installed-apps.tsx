'use client'

import { siteConfig } from '@commerce/config/site'
import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import AppStoreLink from '@/components/apps/app-store-link'
import InstallFlow from '@/components/apps/install/install-flow'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import InlineState from '@/components/states/inline-state'
import ResourceTable from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import ViewSelect from '@/components/table/view-select'
import { installedAppsContent } from '@/data/installed-apps'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  APP_STATUSES,
  type AppStatus,
  connectHref,
  installedApps,
  namesSentence,
  openHref,
  settingsHref,
  statusCounts,
} from '@/lib/app-access'
import type { AppSummary } from '@/lib/app-summary'
import { matchesQuery } from '@/lib/apps-gallery'
import { routes } from '@/lib/routes'
import { installedColumns } from './installed-columns'
import PermissionsDialog from './permissions-dialog'
import StatusPills from './status-pills'

type InstalledAppsProps = {
  /** `/apps/install?app=<id>`: open the install flow for this app over the list. */
  installId?: string | undefined
}

const DEFAULT_PER_PAGE = siteConfig.ui.rowsPerPage.default

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

/** Apps → Installed apps (Figma "Installed apps · List"): only what this store installed. */
export default function InstalledApps({ installId }: InstalledAppsProps) {
  // Hooks
  const copy = useCopy(installedAppsContent)
  const fmt = useFormat()
  const router = useRouter()
  const [apps, setApps] = useState<AppSummary[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [storeName, setStoreName] = useState<string | null>(null)
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(DEFAULT_PER_PAGE)
  const [permissionsApp, setPermissionsApp] = useState<AppSummary | null>(null)
  const [uninstalling, setUninstalling] = useState<AppSummary | null>(null)
  const [disconnecting, setDisconnecting] = useState<AppSummary | null>(null)
  const [bulk, setBulk] = useState<{ ids: string[]; clear: () => void } | null>(null)
  const [installing, setInstalling] = useState<string | null>(installId ?? null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once per mount
  useEffect(() => {
    void load()
    api.store
      .current()
      .then((s) => setStoreName(s?.name ?? null))
      .catch(() => setStoreName(null))
  }, [])

  // Helpers
  const load = async () => {
    setFailed(false)
    try {
      setApps(await api.apps.list())
    } catch {
      setFailed(true)
    }
  }
  const byline = (app: AppSummary) =>
    app.kind === 'connection' && app.company
      ? copy.byCompany(app.company)
      : copy.builtBy(siteConfig.brand.name)
  // The sidebar's app links come from the server layout: refresh it so the app goes from Apps.
  const afterChange = async () => {
    await load()
    router.refresh()
  }

  // Event handlers
  const handleStatusChange = (next: AppStatus | null) => {
    setStatus(next)
    setPage(1)
  }

  const handleQueryChange = (next: string) => {
    setQuery(next)
    setPage(1)
  }

  const handlePerPageChange = (next: number) => {
    setPerPage(next)
    setPage(1)
  }

  const handleUninstall = async () => {
    const app = uninstalling
    if (!app) return
    try {
      await api.apps.uninstall({ id: app.id })
      setPermissionsApp(null)
      toast.success(copy.toast.uninstalled(app.name), { description: copy.toast.uninstalledBody })
      await afterChange()
    } catch (err) {
      toast.error(errorText(err, copy.toast.failed))
      throw err
    }
  }

  const handleBulkUninstall = async () => {
    if (!bulk) return
    try {
      const { removed } = await api.apps.uninstallMany({ ids: bulk.ids })
      bulk.clear()
      toast.success(copy.toast.uninstalledMany(removed), {
        description: copy.toast.uninstalledBody,
      })
      await afterChange()
    } catch (err) {
      toast.error(errorText(err, copy.toast.failed))
      throw err
    }
  }

  const handleDisconnect = async () => {
    const app = disconnecting
    if (!app) return
    try {
      await api.apps.disconnect({ id: app.id })
      toast.success(copy.toast.disconnected(app.name))
      await afterChange()
    } catch (err) {
      toast.error(errorText(err, copy.toast.failed))
      throw err
    }
  }

  const handleInstallClosed = () => {
    setInstalling(null)
    if (installId) router.replace(routes.apps.list())
  }

  // Early returns
  if (failed) {
    return (
      <ProoflyListPage title={copy.title}>
        <InlineState
          kind="error"
          heading={copy.loadFailed.heading}
          body={copy.loadFailed.body}
          onRetry={() => void load()}
        />
      </ProoflyListPage>
    )
  }

  // Render logic
  const installed = installedApps(apps ?? [])
  const counts = statusCounts(installed)
  const shown = installed.filter(
    (a) => (status === null || a.status === status) && matchesQuery(a, query),
  )
  const pageItems = shown.slice((page - 1) * perPage, page * perPage)
  const summary =
    installed.length === 0
      ? copy.summary.none
      : [
          copy.summary.installed(installed.length),
          ...(counts.needsSetup > 0 ? [copy.summary.needsSetup(counts.needsSetup)] : []),
          ...(counts.error > 0 ? [copy.summary.problem(counts.error)] : []),
        ].join(' · ')
  const byId = new Map(installed.map((a) => [a.id, a]))
  const bulkNames = (bulk?.ids ?? []).map((id) => byId.get(id)?.name ?? id)
  const browse = <AppStoreLink>{copy.browseStore}</AppStoreLink>
  return (
    <ProoflyListPage
      title={copy.title}
      summary={apps === null ? undefined : summary}
      actions={<AppStoreLink>{copy.browseStore}</AppStoreLink>}
      controls={
        installed.length > 0 ? (
          <StatusPills
            value={status}
            counts={counts}
            total={installed.length}
            onChange={handleStatusChange}
          />
        ) : null
      }
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={installedColumns(copy, fmt, byline)}
        items={pageItems}
        getId={(a) => a.id}
        href={(a) => openHref(a) ?? routes.apps.page(a.id)}
        loading={apps === null}
        query={query}
        onQueryChange={handleQueryChange}
        onClearAll={() => handleStatusChange(null)}
        views={
          <ViewSelect
            value={status}
            onChange={handleStatusChange}
            options={[
              { value: null, label: copy.tabs.all, count: installed.length },
              ...APP_STATUSES.map((s) => ({ value: s, label: copy.tabs[s], count: counts[s] })),
            ]}
          />
        }
        page={page}
        perPage={perPage}
        onPerPageChange={handlePerPageChange}
        total={shown.length}
        onPageChange={setPage}
        bulkActions={(ids, clear) => (
          <Button variant="destructive" size="sm" onClick={() => setBulk({ ids, clear })}>
            <Trash2 aria-hidden="true" />
            {copy.bulk.uninstall(ids.length)}
          </Button>
        )}
        rowActions={(a) => (
          <RowMenu
            items={[
              { label: copy.menu.open, href: openHref(a) ?? undefined, hidden: !openHref(a) },
              a.status === 'needsSetup'
                ? { label: copy.menu.connect, href: connectHref(a) ?? undefined }
                : {
                    label: copy.menu.settings,
                    href: settingsHref(a) ?? undefined,
                    hidden: !settingsHref(a),
                  },
              { label: copy.menu.permissions, onSelect: () => setPermissionsApp(a) },
              {
                label: copy.menu.disconnect,
                onSelect: () => setDisconnecting(a),
                hidden: !a.canDisconnect,
              },
              { label: copy.menu.uninstall, destructive: true, onSelect: () => setUninstalling(a) },
            ]}
          />
        )}
        empty={
          status === null
            ? { heading: copy.empty.heading, body: copy.empty.body, action: browse }
            : { heading: copy.noResults.headingFiltered, body: copy.noResults.body, action: browse }
        }
        noResults={{
          heading: copy.noResults.heading(query),
          body: copy.noResults.body,
          action: browse,
        }}
      />

      <PermissionsDialog
        app={permissionsApp}
        storeName={storeName}
        byline={byline}
        onClose={() => setPermissionsApp(null)}
        onRemove={setUninstalling}
      />

      <ConfirmDialog
        tone="destructive"
        open={uninstalling !== null}
        onOpenChange={(open) => !open && setUninstalling(null)}
        title={copy.confirmUninstall.title(uninstalling?.name ?? '')}
        body={copy.confirmUninstall.body}
        confirmLabel={copy.confirmUninstall.confirm}
        cancelLabel={copy.confirmUninstall.keep}
        onConfirm={handleUninstall}
      />
      <ConfirmDialog
        tone="destructive"
        open={bulk !== null}
        onOpenChange={(open) => !open && setBulk(null)}
        title={copy.confirmBulk.title(bulkNames.length)}
        body={copy.confirmBulk.body(namesSentence(bulkNames, copy))}
        confirmLabel={copy.bulk.uninstall(bulkNames.length)}
        cancelLabel={copy.confirmUninstall.keep}
        onConfirm={handleBulkUninstall}
      />
      <ConfirmDialog
        tone="destructive"
        open={disconnecting !== null}
        onOpenChange={(open) => !open && setDisconnecting(null)}
        title={copy.confirmDisconnect.title(disconnecting?.name ?? '')}
        body={copy.confirmDisconnect.body}
        confirmLabel={copy.confirmDisconnect.confirm}
        cancelLabel={copy.confirmUninstall.keep}
        onConfirm={handleDisconnect}
      />

      <InstallFlow
        appId={installing}
        apps={apps}
        onClose={handleInstallClosed}
        onInstalled={() => void afterChange()}
      />
    </ProoflyListPage>
  )
}
