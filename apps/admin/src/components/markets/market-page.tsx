'use client'

import type { DomainView, MarketView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { ChevronRight, Earth, Pencil, Trash2 } from '@commerce/ui/icons'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import StatusChip from '@/components/layout/status-chip'
import { marketsContent } from '@/data/markets'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import MarketDialog, { type MarketPart } from './market-dialog'

type MarketPageProps = {
  market: MarketView
  /** Every market of the store, for the dialog's taken countries and addresses. */
  markets: MarketView[]
  domains: DomainView[]
}

/** One setting row: its name, its value now, and what opens when it is clicked. */
type HubRow = {
  key: string
  label: string
  value: string
  /** A part of the market dialog, or another admin page. Neither: shown, not clickable. */
  part?: MarketPart
  href?: string
  muted?: boolean
}

const ROW =
  'flex w-full min-w-0 items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none'

/** How a price adjustment reads: +10%, −5%. */
function percent(bp: number): string {
  const value = Math.abs(bp) / 100
  return `${bp < 0 ? '−' : '+'}${Number.isInteger(value) ? value : value.toFixed(1)}%`
}

/**
 * A market's own page, like Shopify's: the switch that shows it to shoppers at the top, then one
 * row per setting with its current value. A row opens just its part of the market dialog, or the
 * admin page that owns it (shipping, theme, policies). Catalogs are not built yet, so that row
 * says so instead of offering a button that does nothing.
 */
export default function MarketPage({ market, markets, domains }: MarketPageProps) {
  // Hooks
  const copy = useCopy(marketsContent)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [part, setPart] = useState<MarketPart | null>(null)
  const [enabled, setEnabled] = useState(market.enabled)
  const [switching, setSwitching] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Event handlers
  const handleToggle = async (next: boolean) => {
    setSwitching(true)
    setEnabled(next)
    try {
      await api.markets.setEnabled({ id: market.id, enabled: next })
      toast.success(next ? copy.toasts.on(market.name) : copy.toasts.off(market.name))
      router.refresh()
    } catch (err) {
      setEnabled(!next)
      toast.error(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setSwitching(false)
    }
  }
  const handleSaved = () => {
    setPart(null)
    router.refresh()
  }
  const handleDelete = async () => {
    try {
      const { outcome } = await api.markets.delete({ id: market.id })
      toast.success(outcome === 'deleted' ? copy.toasts.deleted : copy.toasts.disabled)
      router.push(routes.markets.list())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.toasts.failed)
      throw err
    }
  }

  // Render logic
  const h = copy.hub
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const primaryHost = domains.find((d) => d.isPrimary)?.hostname ?? ''
  const shownCountries = market.countries.slice(0, 3).join(', ')
  const moreCountries = market.countries.length - 3
  const languages = [market.locale, ...market.locales].map((l) => copy.languages[l] ?? l).join(', ')
  const address = market.isPrimary
    ? primaryHost
    : market.subfolder
      ? `${primaryHost}/${market.subfolder}`
      : (market.hostname ?? copy.choice)
  const rounding = copy.dialog.pricing.roundings[market.rounding] ?? ''
  const rows: HubRow[] = [
    {
      key: 'countries',
      label: h.rows.countries,
      value: market.isPrimary
        ? h.primaryCountry
        : moreCountries > 0
          ? copy.moreCountries(shownCountries, moreCountries)
          : shownCountries || h.allCountries(0),
      part: market.isPrimary ? undefined : 'countries',
    },
    {
      key: 'prices',
      label: h.rows.prices,
      value: market.isPrimary
        ? h.storePrices
        : h.prices(
            `${market.currency} · ${copy.currencies[market.currency] ?? market.currency}`,
            market.priceAdjustmentBp === 0
              ? h.noAdjustment
              : h.adjustment(percent(market.priceAdjustmentBp)),
            market.rounding === 'none' ? '' : rounding,
          ),
      part: market.isPrimary ? undefined : 'prices',
    },
    ...(market.isPrimary
      ? []
      : [
          {
            key: 'duties',
            label: h.rows.duties,
            value: market.duties === 'ddp' ? copy.dialog.duties.ddp : copy.dialog.duties.dap,
            part: 'prices' as const,
          },
        ]),
    { key: 'languages', label: h.rows.languages, value: languages, part: 'languages' },
    {
      key: 'address',
      label: h.rows.address,
      value: address,
      part: market.isPrimary ? undefined : 'address',
    },
    { key: 'catalog', label: h.rows.catalog, value: h.catalogAll },
    {
      key: 'shipping',
      label: h.rows.shipping,
      value: h.shipping,
      href: routes.settings.shipping(),
    },
    {
      key: 'theme',
      label: h.rows.theme,
      value: h.theme,
      href: routes.onlineStore.themes(),
    },
    {
      key: 'policies',
      label: h.rows.policies,
      value: h.policies,
      href: routes.settings.policies(),
    },
  ]
  const body = (row: HubRow, clickable: boolean) => (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium text-ink-strong">{row.label}</span>
        <span className="truncate text-caption text-muted-foreground">{row.value}</span>
        {row.key === 'catalog' ? (
          <span className="text-caption text-muted-foreground/80">{h.catalogSoon}</span>
        ) : null}
      </span>
      {clickable ? (
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
    </>
  )

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={market.name}
          summary={address}
          back={{ label: h.back, href: routes.markets.list() }}
          lead={{ kind: 'icon', node: <Earth aria-hidden="true" /> }}
          size="sm"
          badges={
            <>
              {market.isPrimary ? <StatusChip>{copy.primary}</StatusChip> : null}
              <StatusChip tone={enabled ? 'success' : 'neutral'}>
                {enabled ? h.on : h.off}
              </StatusChip>
            </>
          }
          actions={
            canManage ? (
              <ActionMenu
                label={copy.actions.label}
                items={[
                  { label: h.rename, icon: Pencil, onSelect: () => setPart('name') },
                  {
                    label: copy.actions.delete,
                    icon: Trash2,
                    destructive: true,
                    hidden: market.isPrimary,
                    onSelect: () => setDeleting(true),
                  },
                ]}
              />
            ) : null
          }
        />
      }
      main={
        <DataCard title={h.settings} bodyClassName="p-0">
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((row) => (
              <li key={row.key}>
                {row.href ? (
                  <Link href={row.href} className={ROW}>
                    {body(row, true)}
                  </Link>
                ) : row.part && canManage ? (
                  <button
                    type="button"
                    className={ROW}
                    aria-label={h.open(row.label)}
                    onClick={() => setPart(row.part ?? null)}
                  >
                    {body(row, true)}
                  </button>
                ) : (
                  <div className="flex min-w-0 items-center gap-4 px-4 py-3.5">
                    {body(row, false)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </DataCard>
      }
      side={
        market.isPrimary ? null : (
          <DataCard title={h.on}>
            <label htmlFor="market-on" className="flex items-start justify-between gap-4">
              <span className="text-body text-muted-foreground">{h.switchHelp}</span>
              <Switch
                id="market-on"
                aria-label={copy.switchLabel(market.name)}
                checked={enabled}
                disabled={!canManage || switching}
                onCheckedChange={handleToggle}
              />
            </label>
          </DataCard>
        )
      }
    >
      {part ? (
        <MarketDialog
          market={market}
          part={part}
          markets={markets}
          domains={domains}
          onClose={() => setPart(null)}
          onSaved={handleSaved}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.confirmDelete.title(market.name)}
        body={copy.confirmDelete.body}
        confirmLabel={copy.confirmDelete.confirm}
        tone="destructive"
        onConfirm={handleDelete}
      />
    </ProoflyDetailPage>
  )
}
