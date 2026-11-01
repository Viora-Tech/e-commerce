'use client'

import type { PreorderCampaignView, PreorderOverview } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { CircleAlert, Trash2 } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { catalogTab, loadCatalogPicked } from '@/components/catalogs/catalog-pick-sources'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import SaveBar from '@/components/layout/save-bar'
import StatusChip from '@/components/layout/status-chip'
import PickedField from '@/components/pickers/picked-field'
import SelectProductsDialog, {
  type PickedProducts,
} from '@/components/products/select-products-dialog'
import { catalogsContent } from '@/data/catalogs'
import { preordersContent } from '@/data/preorders'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import {
  type CampaignFormState,
  emptyCampaign,
  fromCampaign,
  toCampaignInput,
} from './campaign-form-state'
import CampaignLookCard from './campaign-look-card'
import CampaignRulesCard from './campaign-rules-card'
import CampaignTermsCard from './campaign-terms-card'

type CampaignFormProps = {
  /** The campaign being edited; null creates one. */
  campaign: PreorderCampaignView | null
  markets: PreorderOverview['markets']
  locations: PreorderOverview['locations']
}

const initialForm = (c: PreorderCampaignView | null): CampaignFormState =>
  c ? fromCampaign(c) : emptyCampaign()

/**
 * Create or edit a pre-order campaign as a full page (no drawers, #142 to #144): its name and
 * status, products, ship date, limit and payment, the rules, then the storefront words and
 * colours beside a live preview.
 */
export default function CampaignForm({ campaign, markets, locations }: CampaignFormProps) {
  // Hooks
  const copy = useCopy(preordersContent)
  const { form: pickCopy } = useCopy(catalogsContent)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [form, setForm] = useState<CampaignFormState>(() => initialForm(campaign))
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(campaign)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [picking, setPicking] = useState(false)

  // Helpers
  const patch = (p: Partial<CampaignFormState>) => setForm((f) => ({ ...f, ...p }))

  // Event handlers
  const handleSave = async () => {
    if (!form.name.trim()) {
      setError(copy.toasts.nameNeeded)
      return
    }
    const input = toCampaignInput(form)
    if (!input) {
      setError(copy.toasts.badNumber)
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (!campaign) {
        const created = await api.preorders.campaigns.create(input)
        setSaved(JSON.stringify(form))
        toast.success(copy.toasts.created)
        router.replace(routes.products.preorderCampaign(created.id))
        return
      }
      const fresh = await api.preorders.campaigns.update({ ...input, id: campaign.id })
      const next = fromCampaign(fresh)
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

  const handlePick = (picked: PickedProducts) => {
    const added = picked.map((p) => p.product.id).filter((id) => !form.productIds.includes(id))
    patch({ productIds: [...form.productIds, ...added] })
    setPicking(false)
  }

  const handleDiscard = () => {
    setForm(JSON.parse(saved) as CampaignFormState)
    setError(null)
  }

  const handleDelete = async () => {
    if (!campaign) return
    try {
      await api.preorders.campaigns.delete({ id: campaign.id })
      toast.success(copy.toasts.deleted)
      router.push(routes.products.preorders())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.toasts.failed)
      throw err
    }
  }

  // Render logic
  const f = copy.form
  const canManage = hasPermission(permissions.PRODUCTS_WRITE)
  const dirty = JSON.stringify(form) !== saved
  const statusItems = { active: copy.statuses.active, paused: copy.statuses.paused }

  const header = (
    <>
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
        title={campaign ? campaign.name : f.newTitle}
        back={{ label: f.back, href: routes.products.preorders() }}
        summary={
          campaign
            ? `${f.statsOrders(campaign.orderCount)} · ${formatPaise(campaign.revenuePaise)}`
            : undefined
        }
        badges={
          campaign ? (
            <StatusChip tone={campaign.status === 'active' ? 'success' : 'neutral'}>
              {copy.statuses[campaign.status]}
            </StatusChip>
          ) : undefined
        }
        actions={
          campaign && canManage ? (
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
    </>
  )

  return (
    // The product page's frame (audit #30, #159): a centred main column and a side column.
    <ProoflyDetailPage
      header={header}
      main={
        <>
          <DataCard title={f.products} subtitle={f.productsHelp}>
            {/* The purchase order's picker, with its filters and stock (audit #159). */}
            <PickedField
              kind="products"
              ids={form.productIds}
              tabs={[catalogTab('products', pickCopy)]}
              title={f.pickProducts}
              search={f.searchProducts}
              labels={{ browse: f.browse, nothingPicked: f.nothingPicked, remove: f.remove }}
              loadPicked={(_, ids) => loadCatalogPicked('products', ids, pickCopy)}
              onChange={(next) => patch({ productIds: next.ids })}
              onBrowse={canManage ? () => setPicking(true) : undefined}
            />
          </DataCard>
          {/* One card per question (audit #34): when it ships, how it is paid, its discount,
              where it applies, then how it looks. */}
          <CampaignTermsCard
            form={form}
            disabled={!canManage}
            section="shipping"
            onChange={patch}
          />
          <CampaignTermsCard form={form} disabled={!canManage} section="payment" onChange={patch} />
          <CampaignRulesCard
            form={form}
            markets={markets}
            locations={locations}
            disabled={!canManage}
            section="discount"
            onChange={patch}
          />
          <CampaignRulesCard
            form={form}
            markets={markets}
            locations={locations}
            disabled={!canManage}
            section="where"
            onChange={patch}
          />
          <CampaignLookCard form={form} disabled={!canManage} onChange={patch} />
        </>
      }
      side={
        <DataCard title={f.details}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="campaign-name">{f.name}</FieldLabel>
              <Input
                id="campaign-name"
                size="lg"
                value={form.name}
                maxLength={80}
                placeholder={f.namePlaceholder}
                disabled={!canManage}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="campaign-status">{f.status}</FieldLabel>
              <Select
                items={statusItems}
                value={form.status}
                disabled={!canManage}
                onValueChange={(v) => patch({ status: v === 'paused' ? 'paused' : 'active' })}
              >
                <SelectTrigger size="lg" id="campaign-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{copy.statuses.active}</SelectItem>
                  <SelectItem value="paused">{copy.statuses.paused}</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>{f.statusHelp}</FieldDescription>
            </Field>
          </FieldGroup>
        </DataCard>
      }
    >
      <SelectProductsDialog
        open={picking}
        onOpenChange={setPicking}
        addedProductIds={form.productIds}
        onConfirm={handlePick}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.confirmDelete.title(campaign?.name ?? '')}
        body={copy.confirmDelete.body}
        confirmLabel={copy.confirmDelete.confirm}
        tone="destructive"
        onConfirm={handleDelete}
      />
    </ProoflyDetailPage>
  )
}
