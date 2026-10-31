'use client'

import { permissions } from '@commerce/core/permissions'
import { CircleAlert, Save, Trash2 } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { emptyZone, fromZone, type LoadedZone, toZoneInput, type ZoneFormState } from './form-state'
import ZoneCountriesCard from './zone-countries-card'
import ZonePincodesCard from './zone-pincodes-card'
import ZoneRatesCard from './zone-rates-card'
import ZoneStatesCard from './zone-states-card'

type ZoneFormProps = {
  /** The zone being edited; null creates one. */
  zone: LoadedZone | null
  /** The shipping profile a new zone joins; null means General. */
  profileId?: string | null | undefined
}

const LIST_HREF = '/settings/shipping?tab=section-rates'

const initialForm = (zone: LoadedZone | null): ZoneFormState =>
  zone ? fromZone(zone) : emptyZone()

/** Create or edit a shipping zone: its name, states, PIN code rules and rates. */
export default function ZoneForm({ zone, profileId = null }: ZoneFormProps) {
  // Hooks
  const announceSetup = useSetupNext()
  const { zone: copy } = useCopy(shippingRatesContent)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [form, setForm] = useState<ZoneFormState>(() => initialForm(zone))
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(zone)))
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Helpers
  const patch = (p: Partial<ZoneFormState>) => setForm((f) => ({ ...f, ...p }))

  // Event handlers
  const handleSave = async () => {
    setAttempted(true)
    if (!form.name.trim() || form.countryCodes.length === 0) return
    setBusy(true)
    setServerError(null)
    try {
      const data = { ...toZoneInput(form), profileId }
      if (!zone) {
        const created = await api.shipping.zones.create(data)
        setSaved(JSON.stringify(form))
        toast.success(copy.toasts.created)
        void announceSetup('shipping')
        router.replace(`/settings/shipping/zones/${created.id}`)
        return
      }
      const fresh = await api.shipping.zones.update({ id: zone.id, data })
      const next = fromZone(fresh)
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(copy.toasts.saved)
      void announceSetup('shipping')
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    setForm(JSON.parse(saved) as ZoneFormState)
    setAttempted(false)
    setServerError(null)
  }

  const handleDelete = async () => {
    if (!zone) return
    setBusy(true)
    try {
      await api.shipping.zones.delete({ id: zone.id })
      toast.success(copy.toasts.deleted)
      router.push(backHref)
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  // Render logic
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const dirty = JSON.stringify(form) !== saved
  const nameError = attempted && !form.name.trim() ? copy.errors.name : null
  const countriesMissing = attempted && form.countryCodes.length === 0
  const india = form.countryCodes.includes('IN')
  const title = zone ? zone.name : copy.newTitle
  const owner = zone?.profileId ?? profileId
  const backHref = owner ? routes.settings.shippingProfile(owner) : LIST_HREF

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
        title={title}
        subtitle={copy.meta}
        back={{ label: copy.backLabel, href: backHref }}
        actions={
          !canManage ? null : zone ? (
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

      <DataCard title={copy.details.heading} subtitle={copy.precedence}>
        <Field data-invalid={nameError ? true : undefined} className="max-w-md">
          <FieldLabel htmlFor="zone-name">{copy.details.name}</FieldLabel>
          <Input
            id="zone-name"
            size="lg"
            value={form.name}
            placeholder={copy.details.namePlaceholder}
            onChange={(e) => patch({ name: e.target.value })}
            disabled={!canManage}
          />
          {nameError ? (
            <FieldError>{nameError}</FieldError>
          ) : (
            <FieldDescription>{copy.details.nameHelp}</FieldDescription>
          )}
        </Field>
      </DataCard>
      <ZoneRatesCard
        value={form.rates}
        onChange={(rates) => patch({ rates })}
        disabled={!canManage}
      />
      <ZoneCountriesCard
        value={form.countryCodes}
        onChange={(countryCodes) => patch({ countryCodes })}
        invalid={countriesMissing}
        disabled={!canManage}
      />
      {india ? (
        <>
          <ZoneStatesCard
            value={form.stateCodes}
            onChange={(stateCodes) => patch({ stateCodes })}
            disabled={!canManage}
          />
          <ZonePincodesCard
            value={form.pincodeRules}
            onChange={(pincodeRules) => patch({ pincodeRules })}
            disabled={!canManage}
          />
        </>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={copy.delete.title(zone?.name ?? '')}
        body={copy.delete.body}
        confirmLabel={copy.delete.confirm}
        cancelLabel={copy.delete.cancel}
        busy={busy}
        onConfirm={handleDelete}
      />
    </div>
  )
}
