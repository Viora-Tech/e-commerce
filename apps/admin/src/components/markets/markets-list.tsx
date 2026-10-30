'use client'

import type { CatalogSummary, DomainView, MarketView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { Earth, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import type { StoreDefaults } from '@/app/(admin)/markets/load'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import EmptyState from '@/components/layout/empty-state'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import SettingsTable from '@/components/settings/settings-table'
import { marketsContent } from '@/data/markets'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import MarketRow from './market-row'
import MarketSuggestionCard from './market-suggestion-card'
import MarketsGraph from './markets-graph'

type MarketsListProps = {
  /** Every market, the primary one (India) first. */
  markets: MarketView[]
  domains: DomainView[]
  /** For the Graph view: catalog names on the market cards. */
  catalogs: CatalogSummary[]
  /** What every market starts from (the Graph view's Store defaults card). */
  defaults: StoreDefaults
  /** Settings for every market: whether the online store suggests the visitor's market. */
  suggestMarket: boolean
}

type View = 'list' | 'graph'

/**
 * Markets (Shopify Markets style, a top-level page): the primary market first, then each market with
 * its countries, currency, languages and the address shoppers reach it on.
 */
export default function MarketsList({
  markets,
  domains,
  catalogs,
  defaults,
  suggestMarket,
}: MarketsListProps) {
  // Hooks
  const copy = useCopy(marketsContent)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [view, setView] = useState<View>('list')
  const [deleting, setDeleting] = useState<MarketView | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  // A switch flips at once and stays flipped while the page reloads its markets.
  const [enabledNow, setEnabledNow] = useState<Record<string, boolean>>({})

  // Event handlers
  const handleView = (next: string[]) => {
    const picked = next[0]
    if (picked === 'list' || picked === 'graph') setView(picked)
  }
  const handleToggle = async (market: MarketView, enabled: boolean) => {
    setSwitching(market.id)
    setEnabledNow((now) => ({ ...now, [market.id]: enabled }))
    try {
      await api.markets.setEnabled({ id: market.id, enabled })
      toast.success(enabled ? copy.toasts.on(market.name) : copy.toasts.off(market.name))
      router.refresh()
    } catch (err) {
      setEnabledNow((now) => ({ ...now, [market.id]: market.enabled }))
      toast.error(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setSwitching(null)
    }
  }
  const handleDelete = async () => {
    if (!deleting) return
    try {
      const { outcome } = await api.markets.delete({ id: deleting.id })
      toast.success(outcome === 'deleted' ? copy.toasts.deleted : copy.toasts.disabled)
      // A market with orders is turned off instead: show what the server now holds.
      setEnabledNow(({ [deleting.id]: _gone, ...rest }) => rest)
      setDeleting(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.toasts.failed)
      throw err
    }
  }

  // Render logic
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const primaryHost = domains.find((d) => d.isPrimary)?.hostname ?? ''
  const onlyPrimary = markets.every((m) => m.isPrimary)
  const shown = markets.map((m) => ({ ...m, enabled: enabledNow[m.id] ?? m.enabled }))
  const addButton = canManage ? (
    <Button render={<Link href={routes.markets.new()} />} nativeButton={false}>
      <Plus aria-hidden="true" />
      {copy.add}
    </Button>
  ) : null
  const viewSwitch = (
    <ToggleGroup
      aria-label={copy.view.label}
      value={[view]}
      onValueChange={handleView}
      variant="outline"
      spacing={0}
      className="self-start"
    >
      <ToggleGroupItem value="list">{copy.view.list}</ToggleGroupItem>
      <ToggleGroupItem value="graph">{copy.view.graph}</ToggleGroupItem>
    </ToggleGroup>
  )

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.intro}
      actions={addButton}
      controls={viewSwitch}
    >
      {view === 'graph' ? (
        <MarketsGraph markets={shown} domains={domains} catalogs={catalogs} defaults={defaults} />
      ) : (
        <SettingsTable
          heading={copy.listTitle}
          columns={[
            { label: copy.columns.market },
            { label: copy.columns.countries, className: 'hidden sm:table-cell' },
            { label: copy.columns.currency },
            { label: copy.columns.languages, className: 'hidden md:table-cell' },
            { label: copy.columns.active, center: true },
          ]}
          actions={canManage}
          after={
            onlyPrimary ? (
              <div className="border-line border-t">
                <EmptyState
                  icon={Earth}
                  heading={copy.empty.heading}
                  body={copy.empty.body}
                  action={
                    canManage ? (
                      <Button
                        variant="outline"
                        render={<Link href={routes.markets.new()} />}
                        nativeButton={false}
                      >
                        {copy.empty.action}
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : undefined
          }
        >
          {shown.map((m) => (
            <MarketRow
              key={m.id}
              market={m}
              primaryHost={primaryHost}
              canManage={canManage}
              switching={switching === m.id}
              href={routes.markets.detail(m.id)}
              onEdit={() => router.push(routes.markets.detail(m.id))}
              onDelete={() => setDeleting(m)}
              onToggle={(enabled) => handleToggle(m, enabled)}
            />
          ))}
        </SettingsTable>
      )}
      <MarketSuggestionCard suggestMarket={suggestMarket} canManage={canManage} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={copy.confirmDelete.title(deleting?.name ?? '')}
        body={copy.confirmDelete.body}
        confirmLabel={copy.confirmDelete.confirm}
        tone="destructive"
        onConfirm={handleDelete}
      />
    </ProoflyListPage>
  )
}
