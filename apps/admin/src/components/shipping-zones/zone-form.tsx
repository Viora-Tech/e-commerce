'use client'

import { permissions } from '@commerce/core/permissions'
import { CircleAlert, Trash2 } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import { emptyZone, fromZone, type LoadedZone, toZoneInput, type ZoneFormState } from './form-state'
import ZonePincodesCard from './zone-pincodes-card'
import ZoneRatesCard from './zone-rates-card'
import ZoneStatesCard from './zone-states-card'

type ZoneFormProps = {
  /** The zone being edited; null creates one. */
  zone: LoadedZone | null
}

const LIST_HREF = '/settings/shipping?tab=section-rates'

const initialForm = (zone: LoadedZone | null): ZoneFormState =>
  zone ? fromZone(zone) : emptyZone()

/** Create or edit a shipping zone: its name, states, PIN code rules and rates. */
export default function ZoneForm({ zone }: ZoneFormProps) {
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
    if (!form.name.trim()) return
    setBusy(true)
    setServerError(null)
    try {
      const data = toZoneInput(form)
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
  const dirty = JSON.stringify(form) !== saved
  const nameError = attempted && !form.name.trim() ? copy.errors.name : null
  const title = zone ? zone.name : copy.newTitle

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
        back={{ label: copy.backLabel, href: LIST_HREF }}
        actions={
          !canManage ? null : zone ? (
            <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <Trash2 />
              {copy.delete.action}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={busy || !dirty}>
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

      <DataCard title={copy.details.heading} meta={copy.precedence}>
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

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.delete.title(zone?.name ?? '')}</AlertDialogTitle>
            <AlertDialogDescription>{copy.delete.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{copy.delete.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={busy}>
              {copy.delete.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
