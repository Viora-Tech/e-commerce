'use client'

import { permissions } from '@commerce/core/permissions'
import { Save, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import SaveErrorAlert from '@/components/approvals/save-error-alert'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import GeneralMoveCard from './general-move-card'
import ProfileProductsCard from './profile-products-card'
import { type ProfileProductRow, rowsFrom, toPlacement } from './profile-products-state'
import ShippingZonesCard from './shipping-zones-card'

type LoadedProfile = NonNullable<Awaited<ReturnType<typeof api.shipping.profiles.get>>>

type ProfileFormProps = {
  /** The profile being edited; null creates one. */
  profile: LoadedProfile | null
  /** General only: another profile has delivery areas, so General needs its own to sell. */
  othersHaveAreas?: boolean
}

type ProfileFormState = { name: string; rows: ProfileProductRow[] }

const LIST_HREF = '/settings/shipping?tab=section-rates'

const initialForm = (profile: LoadedProfile | null): ProfileFormState => ({
  name: profile?.name ?? '',
  rows: rowsFrom(profile?.entries ?? []),
})

/** What a save would write: compared with the last save to tell whether the page changed. */
const fingerprint = (form: ProfileFormState) =>
  JSON.stringify({ name: form.name, ...toPlacement(form.rows) })

/**
 * A shipping profile's page: its name, products and variants (custom profiles only) and its
 * delivery areas with their prices. General holds every product and variant not placed in
 * another profile.
 */
export default function ProfileForm({ profile, othersHaveAreas = false }: ProfileFormProps) {
  // Hooks
  const { profile: copy } = useCopy(shippingRatesContent)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [form, setForm] = useState<ProfileFormState>(() => initialForm(profile))
  const [saved, setSaved] = useState(() => initialForm(profile))
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setAttempted(true)
    if (!form.name.trim()) return
    setBusy(true)
    setServerError(null)
    try {
      const data = { name: form.name.trim(), ...toPlacement(form.rows) }
      if (!profile) {
        const created = await api.shipping.profiles.create(data)
        setSaved(form)
        toast.success(copy.toasts.created)
        router.replace(routes.settings.shippingProfile(created.id))
        return
      }
      const fresh = await api.shipping.profiles.update({ id: profile.id, data })
      const next = initialForm(fresh)
      setForm(next)
      setSaved(next)
      toast.success(copy.toasts.saved)
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    setForm(saved)
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

  // Render logic
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const general = profile?.isDefault === true
  const dirty = fingerprint(form) !== fingerprint(saved)
  const nameError = attempted && !form.name.trim() ? copy.errors.name : null

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
            <Button loading={busy} onClick={handleSave} disabled={busy || !dirty}>
              <Save aria-hidden="true" />
              {copy.saveBar.save}
            </Button>
          )
        }
      />
      {serverError ? <SaveErrorAlert title={copy.toasts.failed} message={serverError} /> : null}

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
      {general ? <GeneralMoveCard canManage={canManage} onError={setServerError} /> : null}
      {general ? null : (
        <ProfileProductsCard
          profileId={profile?.id ?? null}
          rows={form.rows}
          canManage={canManage}
          onChange={(rows) => setForm((f) => ({ ...f, rows }))}
          onError={setServerError}
        />
      )}
      {profile ? (
        <ShippingZonesCard
          zones={profile.zones}
          profileId={profile.id}
          general={general}
          blocked={general && othersHaveAreas}
        />
      ) : (
        <p className="text-body text-muted-foreground">{copy.zones.saveFirst}</p>
      )}

      <ConfirmDialog
        tone="destructive"
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
