'use client'

import { permissions } from '@commerce/core/permissions'
import { CircleAlert, Folder, Save, Trash2 } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { itemTabs, loadPicked } from '@/components/discounts/pick-sources'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import PickedField from '@/components/pickers/picked-field'
import ResourcePickDialog from '@/components/pickers/resource-pick-dialog'
import { discountFormContent } from '@/data/discounts'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ShippingZonesCard from './shipping-zones-card'

type LoadedProfile = NonNullable<Awaited<ReturnType<typeof api.shipping.profiles.get>>>

type ProfileFormProps = {
  /** The profile being edited; null creates one. */
  profile: LoadedProfile | null
}

type ProfileFormState = { name: string; productIds: string[] }

const LIST_HREF = '/settings/shipping?tab=section-rates'

const initialForm = (profile: LoadedProfile | null): ProfileFormState => ({
  name: profile?.name ?? '',
  productIds: profile?.productIds ?? [],
})

/**
 * A shipping profile's page: its name and products (custom profiles only) and its delivery
 * areas with their prices. General holds every product not placed in another profile.
 */
export default function ProfileForm({ profile }: ProfileFormProps) {
  // Hooks
  const { profile: copy } = useCopy(shippingRatesContent)
  const discountCopy = useCopy(discountFormContent)
  const locale = useLocale()
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [form, setForm] = useState<ProfileFormState>(() => initialForm(profile))
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(profile)))
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pickingCollections, setPickingCollections] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setAttempted(true)
    if (!form.name.trim()) return
    setBusy(true)
    setServerError(null)
    try {
      const data = { name: form.name.trim(), productIds: form.productIds }
      if (!profile) {
        const created = await api.shipping.profiles.create(data)
        setSaved(JSON.stringify(form))
        toast.success(copy.toasts.created)
        router.replace(routes.settings.shippingProfile(created.id))
        return
      }
      const fresh = await api.shipping.profiles.update({ id: profile.id, data })
      const next = initialForm(fresh)
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(copy.toasts.saved)
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    setForm(JSON.parse(saved) as ProfileFormState)
    setAttempted(false)
    setServerError(null)
  }

  const handleDelete = async () => {
    if (!profile) return
    setBusy(true)
    try {
      await api.shipping.profiles.delete({ id: profile.id })
      toast.success(copy.toasts.deleted)
      router.push(LIST_HREF)
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  const handleCollections = async (collectionIds: string[]) => {
    setPickingCollections(false)
    if (collectionIds.length === 0) return
    try {
      const ids = await api.shipping.profiles.collectionProducts({ collectionIds })
      const added = ids.filter((id) => !form.productIds.includes(id))
      setForm((f) => ({ ...f, productIds: [...f.productIds, ...added] }))
      toast.success(copy.products.added(added.length))
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
    }
  }

  // Render logic
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const general = profile?.isDefault === true
  const dirty = JSON.stringify(form) !== saved
  const nameError = attempted && !form.name.trim() ? copy.errors.name : null
  const tabs = itemTabs(discountCopy.value, locale)
  const productTabs = tabs.filter((t) => t.key === 'products')
  const collectionTabs = tabs.filter((t) => t.key === 'collections')

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty && canManage}
        message={copy.saveBar.message}
        saveLabel={copy.saveBar.save}
        discardLabel={copy.saveBar.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={profile ? profile.name : copy.newTitle}
        subtitle={general ? copy.generalMeta : copy.meta}
        back={{ label: copy.backLabel, href: LIST_HREF }}
        actions={
          !canManage || general ? null : profile ? (
            <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <Trash2 />
              {copy.delete.action}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={busy || !dirty}>
              <Save aria-hidden="true" />
              {copy.saveBar.save}
            </Button>
          )
        }
      />
      {serverError ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.toasts.failed}</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      {general ? null : (
        <DataCard title={copy.details.heading}>
          <Field data-invalid={nameError ? true : undefined} className="max-w-md">
            <FieldLabel htmlFor="profile-name">{copy.details.name}</FieldLabel>
            <Input
              id="profile-name"
              size="lg"
              value={form.name}
              placeholder={copy.details.namePlaceholder}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={!canManage}
            />
            {nameError ? (
              <FieldError>{nameError}</FieldError>
            ) : (
              <FieldDescription>{copy.details.nameHelp}</FieldDescription>
            )}
          </Field>
        </DataCard>
      )}
      {general ? null : (
        <DataCard
          title={copy.products.heading}
          subtitle={copy.products.meta}
          footer={
            canManage ? (
              <Button variant="outline" onClick={() => setPickingCollections(true)}>
                <Folder aria-hidden="true" />
                {copy.products.addCollection}
              </Button>
            ) : null
          }
        >
          <PickedField
            kind="products"
            ids={form.productIds}
            tabs={productTabs}
            title={copy.products.pickTitle}
            search={copy.products.search}
            labels={{
              browse: copy.products.browse,
              nothingPicked: copy.products.nothingPicked,
              remove: copy.products.remove,
            }}
            loadPicked={(_kind, ids) => loadPicked('products', ids, discountCopy.value, locale)}
            onChange={({ ids }) => setForm((f) => ({ ...f, productIds: ids }))}
          />
        </DataCard>
      )}
      {profile ? (
        <ShippingZonesCard zones={profile.zones} profileId={profile.id} general={general} />
      ) : (
        <p className="text-body text-muted-foreground">{copy.zones.saveFirst}</p>
      )}

      <ResourcePickDialog
        open={pickingCollections}
        title={copy.products.collectionTitle}
        tabs={collectionTabs}
        selected={{ tab: 'collections', ids: [] }}
        onClose={() => setPickingCollections(false)}
        onDone={(r) => void handleCollections(r.ids)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={copy.delete.title(profile?.name ?? '')}
        body={copy.delete.body}
        confirmLabel={copy.delete.confirm}
        cancelLabel={copy.delete.cancel}
        busy={busy}
        onConfirm={handleDelete}
      />
    </div>
  )
}
