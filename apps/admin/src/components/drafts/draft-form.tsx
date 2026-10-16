'use client'

import { ChevronLeftIcon, FileEdit } from '@commerce/ui/icons'
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
import { Card } from '@commerce/ui/shadcn/card'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import DraftActionsCard from '@/components/drafts/draft-actions-card'
import DraftAddressCard from '@/components/drafts/draft-address-card'
import DraftCustomerCard from '@/components/drafts/draft-customer-card'
import {
  type DraftFormState,
  draftToForm,
  emptyDraft,
  formToDraft,
} from '@/components/drafts/draft-form-state'
import DraftProductsCard from '@/components/drafts/draft-products-card'
import DraftTotalsCard from '@/components/drafts/draft-totals-card'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import StatusChip from '@/components/layout/status-chip'
import { draftEditorContent, draftsContent } from '@/data/drafts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Draft = NonNullable<Awaited<ReturnType<typeof api.orders.getDraft>>>

type DraftFormProps = { draft: Draft | null; invoiceSent?: boolean }

/** The GST already inside a saved draft's prices, when it recorded a rate. */
function draftTax(draft: Draft | null) {
  const rate = (draft?.taxBreakdown as { ratePercent?: unknown } | null)?.ratePercent
  if (!draft || draft.taxPaise <= 0 || typeof rate !== 'number') return null
  return { ratePercent: rate, taxPaise: draft.taxPaise }
}

const message = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

export default function DraftForm({ draft, invoiceSent = false }: DraftFormProps) {
  // Hooks
  const router = useRouter()
  const copy = useCopy(draftEditorContent)
  const list = useCopy(draftsContent)
  const fmt = useFormat()
  const [id, setId] = useState<string | null>(draft?.id ?? null)
  const [number, setNumber] = useState<number | null>(draft?.number ?? null)
  const [saved, setSaved] = useState<DraftFormState>(draft ? draftToForm(draft) : emptyDraft())
  const [form, setForm] = useState<DraftFormState>(saved)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [sent, setSent] = useState(invoiceSent)

  // Helpers
  const patch = (next: Partial<DraftFormState>) => setForm((f) => ({ ...f, ...next }))

  const persist = async () => {
    const r = await api.orders.saveDraft({
      ...(id ? { id } : {}),
      draft: formToDraft(form),
    })
    setId(r.id)
    setSaved(form)
    if (!number) {
      const fresh = await api.orders.getDraft({ id: r.id })
      setNumber(fresh?.number ?? null)
      window.history.replaceState(null, '', `/orders/drafts/${r.id}`)
    }
    return r.id
  }

  // Event handlers
  const handleSave = async () => {
    setBusy(true)
    try {
      await persist()
      toast.success(copy.saved)
    } catch (err) {
      toast.error(message(err, copy.saveFailed))
    } finally {
      setBusy(false)
    }
  }

  const handleSendInvoice = async () => {
    if (!id) return
    setBusy(true)
    try {
      const r = await api.orders.sendInvoice({ id })
      setSent(true)
      toast.success(copy.actions.invoiceSent(r.sentTo))
    } catch (err) {
      toast.error(message(err, copy.actions.invoiceFailed))
    } finally {
      setBusy(false)
    }
  }

  const handleConvert = async () => {
    if (!id) return
    setBusy(true)
    try {
      await api.orders.convertDraft({ id, paymentMethod: form.paymentMethod })
      toast.success(copy.actions.converted)
      router.push(routes.orders.detail(id))
    } catch (err) {
      toast.error(message(err, copy.actions.convertFailed))
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setBusy(true)
    try {
      await api.orders.deleteDraft({ id })
      toast.success(copy.actions.deleted)
      router.push(routes.orders.drafts())
    } catch (err) {
      toast.error(message(err, copy.actions.deleteFailed))
      setBusy(false)
    }
  }

  // Render logic
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const itemCount = form.lines.reduce((sum, l) => sum + l.quantity, 0)
  const who = form.customerName || form.email
  const subtitle = [
    who ? copy.subtitle.for(who) : null,
    itemCount > 0 ? copy.subtitle.items(itemCount) : null,
    draft ? copy.subtitle.created(fmt.date(draft.placedAt)) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <PageBody className="gap-6 md:py-8">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={() => {
          setForm(saved)
          setResetKey((k) => k + 1)
        }}
        saving={busy}
      />
      <div className="flex flex-col gap-3">
        <Link
          href={routes.orders.drafts()}
          className="flex w-fit items-center gap-1 text-body text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" />
          {list.title}
        </Link>
        <PageHeader
          title={number ? copy.editTitle(number) : copy.newTitle}
          icon={<FileEdit aria-hidden="true" />}
          subtitle={subtitle}
          actions={
            <>
              <Button variant="outline" disabled={!id || dirty || busy} onClick={handleSendInvoice}>
                {copy.actions.sendInvoice}
              </Button>
              <Button disabled={!id || dirty || busy} onClick={handleConvert}>
                {copy.actions.convert}
              </Button>
            </>
          }
          badges={
            number ? (
              <StatusChip tone={sent ? 'attention' : 'info'}>
                {sent ? list.status.invoiceSent : list.status.open}
              </StatusChip>
            ) : null
          }
        />
      </div>
      <PageColumns
        main={
          <>
            <DraftProductsCard lines={form.lines} onChange={(lines) => patch({ lines })} />
            <DraftTotalsCard key={resetKey} form={form} tax={draftTax(draft)} onChange={patch} />
            <Card gap={3} inset={5}>
              <p className="text-card-title text-ink-strong">{copy.note.heading}</p>
              <Textarea
                value={form.note}
                onChange={(e) => patch({ note: e.target.value })}
                placeholder={copy.note.placeholder}
                rows={3}
              />
            </Card>
          </>
        }
        side={
          <>
            <DraftCustomerCard form={form} onChange={patch} />
            <DraftAddressCard address={form.address} onChange={(address) => patch({ address })} />
            <DraftActionsCard
              saved={Boolean(id) && !dirty}
              busy={busy}
              paymentMethod={form.paymentMethod}
              onPaymentMethod={(paymentMethod) => patch({ paymentMethod })}
              onDelete={() => setConfirmDelete(true)}
            />
          </>
        }
      />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.actions.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.actions.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{copy.actions.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  )
}
