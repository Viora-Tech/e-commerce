'use client'

import type { PreorderCampaignView, PreorderOverview } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { CircleAlert, Trash2 } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { catalogTab, loadCatalogPicked } from '@/components/catalogs/catalog-pick-sources'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import StatusChip from '@/components/layout/status-chip'
import PickedField from '@/components/pickers/picked-field'
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

  return (
    <PageBody className="mx-auto max-w-[64rem] gap-4">
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

      <DataCard title={f.details}>
        <FieldGroup>
          <Field className="max-w-md">
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
          <Field className="max-w-md">
            <FieldLabel htmlFor="campaign-status">{f.status}</FieldLabel>
            <NativeSelect
              id="campaign-status"
              value={form.status}
              disabled={!canManage}
              onChange={(e) => patch({ status: e.target.value === 'paused' ? 'paused' : 'active' })}
            >
              <NativeSelectOption value="active">{copy.statuses.active}</NativeSelectOption>
              <NativeSelectOption value="paused">{copy.statuses.paused}</NativeSelectOption>
            </NativeSelect>
            <FieldDescription>{f.statusHelp}</FieldDescription>
          </Field>
        </FieldGroup>
      </DataCard>

      <DataCard title={f.products} subtitle={f.productsHelp}>
        <PickedField
          kind="products"
          ids={form.productIds}
          tabs={[catalogTab('products', pickCopy)]}
          title={f.pickProducts}
          search={f.searchProducts}
          labels={{ browse: f.browse, nothingPicked: f.nothingPicked, remove: f.remove }}
          loadPicked={(_, ids) => loadCatalogPicked('products', ids, pickCopy)}
          onChange={(next) => patch({ productIds: next.ids })}
        />
      </DataCard>

      <CampaignTermsCard form={form} disabled={!canManage} onChange={patch} />
      <CampaignRulesCard
        form={form}
        markets={markets}
        locations={locations}
        disabled={!canManage}
        onChange={patch}
      />
      <CampaignLookCard form={form} disabled={!canManage} onChange={patch} />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.confirmDelete.title(campaign?.name ?? '')}
        body={copy.confirmDelete.body}
        confirmLabel={copy.confirmDelete.confirm}
        tone="destructive"
        onConfirm={handleDelete}
      />
    </PageBody>
  )
}
