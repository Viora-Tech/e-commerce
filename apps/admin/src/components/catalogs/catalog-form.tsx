'use client'

import type { CatalogSummary, CatalogView, MarketView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { CircleAlert, Trash2 } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import StatusChip from '@/components/layout/status-chip'
import { catalogsContent } from '@/data/catalogs'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import {
  adjustmentBp,
  amountMinor,
  type CatalogFormState,
  emptyCatalog,
  fromCatalog,
} from './catalog-form-state'
import CatalogMarketsCard from './catalog-markets-card'
import CatalogPriceTableCard from './catalog-price-table-card'
import CatalogPricesCard from './catalog-prices-card'
import CatalogProductsCard from './catalog-products-card'

type CatalogFormProps = {
  /** The catalog being edited; null creates one. */
  catalog: CatalogView | null
  markets: MarketView[]
  catalogs: CatalogSummary[]
}

const initialForm = (c: CatalogView | null): CatalogFormState =>
  c ? fromCatalog(c) : emptyCatalog()

/**
 * What the picked markets mean for prices: a rupee market locks them (its checkout charges the
 * products' own prices), and fixed prices are typed in the first market abroad's currency.
 */
function pricingOf(markets: MarketView[], marketIds: string[]) {
  const picked = markets.filter((m) => marketIds.includes(m.id))
  return {
    rupeeLocked: picked.some((m) => m.currency === 'INR'),
    currency: picked.find((m) => m.currency !== 'INR')?.currency ?? null,
  }
}

/**
 * Create or edit a catalog as a full page (no drawers): its name and status, the markets that
 * sell from it, the products it sells and its price change, Shopify style.
 */
export default function CatalogForm({ catalog, markets, catalogs }: CatalogFormProps) {
  // Hooks
  const copy = useCopy(catalogsContent)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [form, setForm] = useState<CatalogFormState>(() => initialForm(catalog))
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(catalog)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Helpers
  const patch = (p: Partial<CatalogFormState>) => setForm((f) => ({ ...f, ...p }))

  // Event handlers
  const handleSave = async () => {
    if (!form.name.trim()) {
      setError(copy.toasts.nameNeeded)
      return
    }
    const { rupeeLocked, currency } = pricingOf(markets, form.marketIds)
    const bp = adjustmentBp(form)
    const prices =
      currency && !rupeeLocked
        ? form.prices.map((p) => ({
            variantId: p.variantId,
            currency,
            amountMinor: amountMinor(p.amount, currency),
          }))
        : []
    if (bp === null || prices.some((p) => p.amountMinor === null)) {
      setError(copy.toasts.badAmount)
      return
    }
    setBusy(true)
    setError(null)
    const input = {
      name: form.name,
      status: form.status,
      scope: form.scope,
      priceAdjustmentBp: rupeeLocked ? 0 : bp,
      productIds: form.productIds,
      collectionIds: form.collectionIds,
      marketIds: form.marketIds,
      prices: prices.map((p) => ({ ...p, amountMinor: p.amountMinor as number })),
    }
    try {
      if (!catalog) {
        const created = await api.catalogs.create(input)
        setSaved(JSON.stringify(form))
        toast.success(copy.toasts.created)
        router.replace(routes.catalogs.detail(created.id))
        return
      }
      const fresh = await api.catalogs.update({ ...input, id: catalog.id })
      const next = fromCatalog(fresh)
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(copy.toasts.saved)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    setForm(JSON.parse(saved) as CatalogFormState)
    setError(null)
  }

  const handleDelete = async () => {
    if (!catalog) return
    try {
      await api.catalogs.delete({ id: catalog.id })
      toast.success(copy.toasts.deleted)
      router.push(routes.catalogs.list())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.toasts.failed)
      throw err
    }
  }

  // Render logic
  const f = copy.form
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const dirty = JSON.stringify(form) !== saved
  const { rupeeLocked, currency } = pricingOf(markets, form.marketIds)

  return (
    // One form column, centred, as Rollouts.
    <PageBody className="mx-auto max-w-[52rem] gap-4">
      <SaveBar
        open={dirty && canManage}
        message={f.unsaved}
        saveLabel={f.save}
        discardLabel={f.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={catalog ? catalog.name : f.newTitle}
        back={{ label: f.back, href: routes.catalogs.list() }}
        badges={
          catalog ? (
            <StatusChip tone={catalog.status === 'active' ? 'success' : 'neutral'}>
              {copy.statuses[catalog.status]}
            </StatusChip>
          ) : undefined
        }
        actions={
          catalog && canManage ? (
            <ActionMenu
              label={f.actions}
              items={[
                {
                  label: f.delete,
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => setDeleting(true),
                },
              ]}
            />
          ) : null
        }
      />
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.toasts.failed}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <DataCard title={f.details}>
        <FieldGroup>
          {/* Shopify's top card: the title with its status beside it, then the markets row. */}
          <Field>
            <FieldLabel htmlFor="catalog-name">{f.name}</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="catalog-name"
                className="min-w-0 flex-1"
                value={form.name}
                maxLength={80}
                placeholder={f.namePlaceholder}
                disabled={!canManage}
                onChange={(e) => patch({ name: e.target.value })}
              />
              <NativeSelect
                id="catalog-status"
                aria-label={f.status}
                className="w-32"
                value={form.status}
                disabled={!canManage}
                onChange={(e) => patch({ status: e.target.value === 'draft' ? 'draft' : 'active' })}
              >
                <NativeSelectOption value="active">{copy.statuses.active}</NativeSelectOption>
                <NativeSelectOption value="draft">{copy.statuses.draft}</NativeSelectOption>
              </NativeSelect>
            </div>
            <FieldDescription>{f.statusHelp}</FieldDescription>
          </Field>
          <CatalogMarketsCard
            catalogId={catalog?.id ?? null}
            markets={markets}
            catalogs={catalogs}
            marketIds={form.marketIds}
            disabled={!canManage}
            onChange={(marketIds) => patch({ marketIds })}
          />
        </FieldGroup>
      </DataCard>

      <CatalogPricesCard
        form={form}
        currency={currency}
        rupeeLocked={rupeeLocked}
        disabled={!canManage}
        onChange={patch}
      />

      {catalog ? (
        <CatalogPriceTableCard
          catalogId={catalog.id}
          adjustmentBp={rupeeLocked ? 0 : adjustmentBp(form)}
          currency={rupeeLocked ? null : currency}
          prices={form.prices}
          disabled={!canManage}
          onPrices={(prices) => patch({ prices })}
        />
      ) : null}

      <CatalogProductsCard
        scope={form.scope}
        productIds={form.productIds}
        collectionIds={form.collectionIds}
        disabled={!canManage}
        onChange={patch}
      />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.confirmDelete.title(catalog?.name ?? '')}
        body={copy.confirmDelete.body}
        confirmLabel={copy.confirmDelete.confirm}
        tone="destructive"
        onConfirm={handleDelete}
      />
    </PageBody>
  )
}
