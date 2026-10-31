'use client'

import type { CatalogSummary, DomainView, MarketView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import {
  ArrowRight,
  ChevronRight,
  Earth,
  FileText,
  type IconComponent,
  Language,
  Layers,
  LinkIcon,
  Palette,
  Pencil,
  Plus,
  ReceiptIcon,
  ShieldCheck,
  Store,
  Trash2,
  Truck,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import { marketsContent } from '@/data/markets'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { INTL_LOCALE } from '@/lib/i18n'
import { routes } from '@/lib/routes'
import MarketDialog, { type MarketPart } from './market-dialog'
import { adjustmentText } from './market-overrides'

type MarketPageProps = {
  market: MarketView
  /** Every market of the store, for the dialog's taken countries and addresses. */
  markets: MarketView[]
  domains: DomainView[]
  /** The catalog this market sells from (Markets › Catalogs); null sells every product. */
  catalog: CatalogSummary | null
}

/** One setting: its value here, whether the market changes it, and what opens it. */
type Setting = {
  key: string
  icon: IconComponent
  label: string
  value: string
  customized: boolean
  /** A part of the market dialog, or another admin page. Neither: shown, not clickable. */
  part?: MarketPart
  href?: string
}

type SettingRowProps = {
  setting: Setting
  canManage: boolean
  /** "Customize currency and prices": the inherited row's add button. */
  customizeLabel: string
  openLabel: string
  onOpen: (part: MarketPart) => void
}

const CARD = 'rounded-xl border border-border bg-card'

/**
 * A market's own page, laid out as Shopify's: the name with its status beside it and the
 * countries it includes, then the settings this market changes (Customized) and the ones it
 * takes from the store (Inherited, store → value, with a plus to customize). Each row opens its
 * part of the market dialog, or the admin page that owns it.
 */
export default function MarketPage({ market, markets, domains, catalog }: MarketPageProps) {
  // Hooks
  const copy = useCopy(marketsContent)
  const locale = useLocale()
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [part, setPart] = useState<MarketPart | null>(null)
  const [enabled, setEnabled] = useState(market.enabled)
  const [switching, setSwitching] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Helpers
  const languagesOf = (m: MarketView) =>
    [m.locale, ...m.locales].map((l) => copy.languages[l] ?? l).join(', ')
  const currencyOf = (code: string) => `${copy.currencies[code] ?? code} (${code})`

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
  const primary = markets.find((m) => m.isPrimary) ?? market
  const primaryHost = domains.find((d) => d.isPrimary)?.hostname ?? ''
  const own = !market.isPrimary
  const pricesCustomized =
    own &&
    (market.currency !== primary.currency ||
      market.priceAdjustmentBp !== 0 ||
      market.rounding !== 'none')
  const languagesCustomized = own && languagesOf(market) !== languagesOf(primary)
  const address = market.subfolder
    ? `${primaryHost}/${market.subfolder}`
    : (market.hostname ?? primaryHost)
  const rounding = copy.dialog.pricing.roundings[market.rounding] ?? ''
  const catalogValue = catalog
    ? h.catalogOf(
        catalog.name,
        catalog.scope === 'all' ? h.catalogAllProducts : h.catalogProducts(catalog.productCount),
      )
    : h.catalogAll
  const settings: Setting[] = [
    {
      key: 'prices',
      icon: ReceiptIcon,
      label: h.rows.prices,
      value: pricesCustomized
        ? h.prices(
            currencyOf(market.currency),
            market.priceAdjustmentBp === 0
              ? h.noAdjustment
              : h.adjustment(adjustmentText(market.priceAdjustmentBp)),
            market.rounding === 'none' ? '' : rounding,
          )
        : currencyOf(primary.currency),
      customized: pricesCustomized,
      part: own ? 'prices' : undefined,
    },
    ...(own
      ? [
          {
            key: 'duties',
            icon: ShieldCheck,
            label: h.rows.duties,
            value: market.duties === 'ddp' ? copy.dialog.duties.ddp : copy.dialog.duties.dap,
            customized: true,
            part: 'prices' as const,
          },
        ]
      : []),
    {
      key: 'catalog',
      icon: Layers,
      label: h.rows.catalog,
      value: catalog?.status === 'draft' ? `${catalogValue} · ${h.catalogDraft}` : catalogValue,
      customized: catalog !== null,
      href: catalog ? routes.catalogs.detail(catalog.id) : routes.catalogs.list(),
    },
    {
      key: 'languages',
      icon: Language,
      label: h.rows.languages,
      value: languagesOf(market),
      customized: languagesCustomized,
      part: 'languages',
    },
    {
      key: 'address',
      icon: LinkIcon,
      label: h.rows.address,
      value: address,
      customized: own && Boolean(market.subfolder || market.hostname),
      part: own ? 'address' : undefined,
    },
    {
      key: 'theme',
      icon: Palette,
      label: h.rows.theme,
      value: h.theme,
      customized: false,
      href: routes.onlineStore.themes(),
    },
    {
      key: 'shipping',
      icon: Truck,
      label: h.rows.shipping,
      value: h.shipping,
      customized: false,
      href: routes.settings.shipping(),
    },
    {
      key: 'policies',
      icon: FileText,
      label: h.rows.policies,
      value: h.policies,
      customized: false,
      href: routes.settings.policies(),
    },
  ]
  const customized = settings.filter((s) => s.customized)
  const inherited = settings.filter((s) => !s.customized)
  const regions = new Intl.DisplayNames([INTL_LOCALE[locale]], { type: 'region' })
  const countries = market.isPrimary
    ? [h.primaryCountry]
    : market.countries.map((c) => regions.of(c) ?? c)

  return (
    // One column, centred, as Shopify's market page and our Catalogs and Rollouts.
    <PageBody className="mx-auto max-w-[52rem] gap-4">
      <PageHeader
        title={market.name}
        summary={address}
        back={{ label: h.back, href: routes.markets.list() }}
        lead={{ kind: 'icon', node: <Earth aria-hidden="true" /> }}
        size="sm"
        badges={
          <>
            {market.isPrimary ? <StatusChip>{copy.primary}</StatusChip> : null}
            <StatusChip tone={enabled ? 'success' : 'neutral'}>{enabled ? h.on : h.off}</StatusChip>
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

      <section className={`${CARD} flex flex-col gap-3 p-4`}>
        <div className="flex flex-col gap-1.5">
          <span className="text-body font-medium text-ink-strong">{h.name}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canManage}
              onClick={() => setPart('name')}
              aria-label={h.rename}
              className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-input px-3 text-left text-body text-ink-strong hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="truncate">{market.name}</span>
            </button>
            <NativeSelect
              aria-label={h.status}
              className="w-28"
              value={enabled ? 'on' : 'off'}
              disabled={!canManage || switching || market.isPrimary}
              onChange={(e) => handleToggle(e.target.value === 'on')}
            >
              <NativeSelectOption value="on">{h.on}</NativeSelectOption>
              <NativeSelectOption value="off">{h.off}</NativeSelectOption>
            </NativeSelect>
          </div>
          {market.isPrimary ? null : (
            <span className="text-caption text-muted-foreground">{h.switchHelp}</span>
          )}
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
          <span className="w-40 shrink-0 text-body font-medium text-ink-strong">{h.includes}</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {countries.slice(0, 6).map((c) => (
              <span
                key={c}
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-secondary px-2 text-body text-ink-strong"
              >
                <Earth className="size-4 text-muted-foreground" aria-hidden="true" />
                {c}
              </span>
            ))}
            {countries.length > 6 ? (
              <span className="text-caption text-muted-foreground">+{countries.length - 6}</span>
            ) : null}
            {own && canManage ? (
              <Button variant="ghost" size="sm" onClick={() => setPart('countries')}>
                <Pencil aria-hidden="true" />
                {h.editCountries}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-card-title text-ink-strong">{h.customized}</h2>
        <div className={CARD}>
          {customized.length === 0 ? (
            <p className="p-4 text-body text-muted-foreground">{h.customizedEmpty}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {customized.map((s) => (
                <SettingRow
                  key={s.key}
                  setting={s}
                  canManage={canManage}
                  customizeLabel={h.customize(s.label)}
                  openLabel={h.open(s.label)}
                  onOpen={setPart}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-card-title text-ink-strong">{h.inherited}</h2>
        <ul className="flex flex-col">
          {inherited.map((s) => (
            <SettingRow
              key={s.key}
              setting={s}
              canManage={canManage}
              customizeLabel={h.customize(s.label)}
              openLabel={h.open(s.label)}
              onOpen={setPart}
            />
          ))}
        </ul>
      </section>

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
    </PageBody>
  )
}

/**
 * One setting row: icon and name, then its value. An inherited row reads "store → value" with a
 * plus to customize it; a customized row shows its own value and a chevron.
 */
function SettingRow({ setting: s, canManage, customizeLabel, openLabel, onOpen }: SettingRowProps) {
  const Icon = s.icon
  const action = s.customized ? (
    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
  ) : (
    <Plus aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
  )
  const body = (
    <>
      <span className="flex w-48 shrink-0 items-center gap-2 font-medium text-ink-strong">
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        {s.label}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-muted-foreground">
        {s.customized ? null : (
          <>
            <Store aria-hidden="true" className="size-4 shrink-0" />
            <ArrowRight aria-hidden="true" className="size-3.5 shrink-0" />
          </>
        )}
        <span className="truncate text-ink-strong">{s.value}</span>
      </span>
    </>
  )
  const row =
    'flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2.5 text-left text-body transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none'
  return (
    <li>
      {s.href ? (
        <Link href={s.href} className={row} aria-label={s.customized ? openLabel : customizeLabel}>
          {body}
          {action}
        </Link>
      ) : s.part && canManage ? (
        <button
          type="button"
          className={row}
          aria-label={s.customized ? openLabel : customizeLabel}
          onClick={() => s.part && onOpen(s.part)}
        >
          {body}
          {action}
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-3 px-3 py-2.5 text-body">{body}</div>
      )}
    </li>
  )
}
