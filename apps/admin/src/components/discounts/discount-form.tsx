'use client'

import { permissions } from '@commerce/core/permissions'
import { BadgePercent, CircleAlert, Copy, Pause, Play, Save, Trash2 } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import SaveBar from '@/components/layout/save-bar'
import StatusChip from '@/components/layout/status-chip'
import { discountFormContent, discountsContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ConditionsCard from './conditions-card'
import DatesCard from './dates-card'
import DiscountStatusCard from './discount-status-card'
import {
  type DiscountFormState,
  emptyForm,
  formErrors,
  fromDiscount,
  type LoadedDiscount,
  toInput,
} from './form-state'
import MethodCard from './method-card'
import SummaryCard from './summary-card'
import ValueCard from './value-card'

type DiscountFormProps = {
  discount: LoadedDiscount | null
}

function initialForm(discount: LoadedDiscount | null): DiscountFormState {
  return discount ? fromDiscount(discount) : emptyForm()
}

export default function DiscountForm({ discount }: DiscountFormProps) {
  // Hooks
  const copy = useCopy(discountFormContent)
  const list = useCopy(discountsContent)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [form, setForm] = useState<DiscountFormState>(() => initialForm(discount))
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(discount)))
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmPause, setConfirmPause] = useState(false)

  // Helpers
  const patch = (p: Partial<DiscountFormState>) => setForm((f) => ({ ...f, ...p }))

  // Event handlers
  const handleSave = async () => {
    setAttempted(true)
    if (Object.keys(formErrors(form)).length) return
    setBusy(true)
    setServerError(null)
    try {
      const data = toInput(form)
      const result = discount
        ? await api.discounts.update({ id: discount.id, data })
        : await api.discounts.create(data)
      if (!result) throw new Error(copy.toasts.failed)
      toast.success(discount ? copy.toasts.saved : copy.toasts.created)
      if (!discount) {
        router.replace(routes.discounts.detail(result.id))
      } else {
        const fresh = await api.discounts.get({ id: discount.id })
        if (fresh) {
          const next = fromDiscount(fresh)
          setForm(next)
          setSaved(JSON.stringify(next))
        }
        router.refresh()
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    setForm(initialForm(discount))
    setAttempted(false)
    setServerError(null)
  }

  const handleStatus = async (status: 'active' | 'disabled') => {
    if (!discount) return
    setBusy(true)
    setServerError(null)
    try {
      const result = await api.discounts.toggle({ id: discount.id, status })
      if (!result) throw new Error(copy.toasts.failed)
      setForm((f) => ({ ...f, status }))
      setSaved((raw) => JSON.stringify({ ...JSON.parse(raw), status }))
      toast.success(status === 'disabled' ? copy.toasts.paused : copy.toasts.resumed)
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
      setConfirmPause(false)
    }
  }

  const handleDuplicate = async () => {
    if (!discount) return
    setBusy(true)
    setServerError(null)
    try {
      const copied = await api.discounts.duplicate({ id: discount.id })
      if (!copied) throw new Error(copy.toasts.failed)
      toast.success(copy.toasts.duplicated)
      router.push(routes.discounts.detail(copied.id))
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!discount) return
    setBusy(true)
    try {
      const result = await api.discounts.delete({ id: discount.id })
      toast.success(result?.outcome === 'deleted' ? copy.toasts.deleted : copy.toasts.disabled)
      router.push(routes.discounts.list())
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  // Render logic
  const dirty = JSON.stringify(form) !== saved
  const errors = attempted ? formErrors(form) : {}
  const title = discount ? discount.title : copy.newTitle
  const canWrite = hasPermission(permissions.DISCOUNTS_WRITE)
  const paused = form.status === 'disabled'

  const summary = discount
    ? `${form.status === 'active' ? list.lifecycle.active : list.lifecycle.disabled} · ${copy.usedTimes(discount.usedCount)}`
    : copy.newSummary

  return (
    <ProoflyDetailPage
      header={
        <>
          <PageHeader
            title={title}
            summary={summary}
            back={{ label: list.title, href: routes.discounts.list() }}
            lead={{ kind: 'icon', node: <BadgePercent aria-hidden="true" /> }}
            badges={
              discount && form.status === 'disabled' ? (
                <StatusChip>{list.lifecycle.disabled}</StatusChip>
              ) : null
            }
            actions={
              discount ? (
                <>
                  {canWrite ? (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={paused ? () => handleStatus('active') : () => setConfirmPause(true)}
                    >
                      {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                      {paused ? copy.pause.resume : copy.pause.action}
                    </Button>
                  ) : null}
                  {canWrite ? (
                    <Button variant="outline" disabled={busy} onClick={handleDuplicate}>
                      <Copy />
                      {copy.duplicate.action}
                    </Button>
                  ) : null}
                  {canWrite ? (
                    <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                      <Trash2 />
                      {copy.delete.action}
                    </Button>
                  ) : null}
                </>
              ) : dirty ? null : (
                <Button onClick={handleSave} loading={busy}>
                  <Save aria-hidden="true" />
                  {copy.saveBar.save}
                </Button>
              )
            }
          />
          {serverError || Object.keys(errors).length > 0 ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>{copy.toasts.failed}</AlertTitle>
              <AlertDescription>{serverError ?? copy.toasts.fixHighlighted}</AlertDescription>
            </Alert>
          ) : null}
        </>
      }
      main={
        <>
          <MethodCard
            form={form}
            titleError={errors.title}
            codeError={errors.code}
            onChange={patch}
          />
          <ValueCard
            form={form}
            valueError={errors.value}
            productsError={errors.products}
            productValuesError={errors.productValues}
            onChange={patch}
          />
          <ConditionsCard form={form} onChange={patch} />
          <DatesCard form={form} error={errors.dates} onChange={patch} />
        </>
      }
      side={
        <>
          <DiscountStatusCard status={form.status} onChange={(status) => patch({ status })} />
          <SummaryCard form={form} discount={discount} />
        </>
      }
    >
      <SaveBar
        open={dirty}
        message={copy.saveBar.message}
        saveLabel={copy.saveBar.save}
        discardLabel={copy.saveBar.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <ConfirmDialog
        open={confirmPause}
        onOpenChange={setConfirmPause}
        title={copy.pause.title(discount?.title ?? '')}
        body={copy.pause.body}
        confirmLabel={copy.pause.confirm}
        cancelLabel={copy.pause.cancel}
        tone="default"
        onConfirm={() => handleStatus('disabled')}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={copy.delete.title(discount?.title ?? '')}
        body={copy.delete.body}
        confirmLabel={copy.delete.confirm}
        cancelLabel={copy.delete.cancel}
        onConfirm={handleRemove}
      />
    </ProoflyDetailPage>
  )
}
