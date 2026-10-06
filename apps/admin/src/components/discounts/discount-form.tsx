'use client'

import { BadgePercent, CircleAlert, Trash2 } from '@commerce/ui/icons'
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
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { discountFormContent, discountsContent } from '@/data/discounts'
import { api } from '@/lib/api-client'
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

const copy = discountFormContent

function initialForm(discount: LoadedDiscount | null): DiscountFormState {
  return discount ? fromDiscount(discount) : emptyForm()
}

export default function DiscountForm({ discount }: DiscountFormProps) {
  // Hooks
  const router = useRouter()
  const [form, setForm] = useState<DiscountFormState>(() => initialForm(discount))
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(discount)))
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
        router.replace(`/discounts/${result.id}`)
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

  const handleRemove = async () => {
    if (!discount) return
    setBusy(true)
    try {
      const result = await api.discounts.delete({ id: discount.id })
      toast.success(result?.outcome === 'deleted' ? copy.toasts.deleted : copy.toasts.disabled)
      router.push('/discounts')
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

  return (
    <PageBody width="narrow">
      <SaveBar
        open={dirty}
        message={copy.saveBar.message}
        saveLabel={copy.saveBar.save}
        discardLabel={copy.saveBar.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={title}
        icon={<BadgePercent aria-hidden="true" />}
        tone={form.status === 'active' ? 'success' : 'neutral'}
        breadcrumbs={[{ label: discountsContent.title, href: '/discounts' }, { label: title }]}
        actions={
          discount ? (
            <Button
              variant="destructive"
              className="min-w-24"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
              {copy.delete.action}
            </Button>
          ) : dirty ? null : (
            <Button className="min-w-24" onClick={handleSave} disabled={busy}>
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
      <PageColumns
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
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.delete.title(discount?.title ?? '')}</AlertDialogTitle>
            <AlertDialogDescription>{copy.delete.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{copy.delete.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              tone="destructive"
              onClick={handleRemove}
              disabled={busy}
            >
              {copy.delete.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  )
}
