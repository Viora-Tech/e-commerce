'use client'

import { FieldDescription } from '@commerce/ui/shadcn/field'
import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { customerMergeContent } from '@/data/customer-merge'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import type { CustomerDetail } from './customer-detail-types'
import CustomerPicker, { type PickedCustomer } from './customer-picker'
import MergeKeepChoice, { type MergeChoice } from './merge-keep-choice'

type MergeCustomerDialogProps = {
  /** The customer whose page this is; it stays. */
  customer: CustomerDetail
  open: boolean
  onClose: () => void
  onMerged: () => void
}

type Preview = Extract<Awaited<ReturnType<typeof api.customers.previewMerge>>, { ok: true }>
type Keep = { email: MergeChoice; phone: MergeChoice; name: MergeChoice }

const KEEP_THIS: Keep = { email: 'kept', phone: 'kept', name: 'kept' }

/**
 * "Merge with another customer…": pick the other record, see what moves, choose whose email,
 * phone and name to keep, then everything moves onto this customer in one go.
 */
export default function MergeCustomerDialog({
  customer,
  open,
  onClose,
  onMerged,
}: MergeCustomerDialogProps) {
  // Hooks
  const copy = useCopy(customerMergeContent)
  const locale = useLocale()
  const [other, setOther] = useState<PickedCustomer | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [keep, setKeep] = useState<Keep>(KEEP_THIS)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handlePick = async (picked: PickedCustomer) => {
    setOther(picked)
    setPreview(null)
    // An empty field on this customer takes the other record's value by default.
    setKeep({
      email: customer.email ? 'kept' : 'merged',
      phone: customer.phone ? 'kept' : 'merged',
      name: customer.name ? 'kept' : 'merged',
    })
    try {
      setPreview(await api.customers.previewMerge({ keepId: customer.id, mergeId: picked.id }))
    } catch (err) {
      setOther(null)
      toast.error(err instanceof Error ? err.message : copy.failed)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (next) return
    setOther(null)
    setPreview(null)
    setKeep(KEEP_THIS)
    onClose()
  }

  const handleSubmit = async () => {
    if (!other) return
    setSaving(true)
    try {
      await api.customers.merge({ keepId: customer.id, mergeId: other.id, keep })
      toast.success(copy.done)
      handleOpenChange(false)
      onMerged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const moves = preview?.moves
  const lines = moves
    ? [
        moves.orders > 0 ? copy.orders(moves.orders) : null,
        moves.addresses > 0 ? copy.addresses(moves.addresses) : null,
        moves.storeCreditPaise > 0
          ? copy.storeCredit(formatPaise(moves.storeCreditPaise, locale))
          : null,
        moves.giftCards > 0 ? copy.giftCards(moves.giftCards) : null,
        moves.identities + moves.passkeys > 0
          ? copy.signIns(moves.identities + moves.passkeys)
          : null,
        moves.carts > 0 ? copy.carts(moves.carts) : null,
        moves.notes > 0 ? copy.notes(moves.notes) : null,
        moves.reviews > 0 ? copy.reviews(moves.reviews) : null,
        moves.conversations > 0 ? copy.conversations(moves.conversations) : null,
      ].filter((l): l is string => l !== null)
    : []
  const otherLabel = other ? other.name || other.email || '' : ''

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.title}
      description={other ? copy.reviewBody(otherLabel) : copy.pickBody}
      submitLabel={copy.confirm}
      cancelLabel={copy.cancel}
      busy={saving}
      submitDisabled={!preview}
      onSubmit={handleSubmit}
      size="lg"
    >
      <div className="flex flex-col gap-6">
        <CustomerPicker
          id="merge-customer"
          exceptId={customer.id}
          value={other}
          onPick={handlePick}
        />
        {other && preview ? (
          <>
            <section className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3">
              <h3 className="font-medium text-body">{copy.moves}</h3>
              {lines.length > 0 ? (
                <ul className="list-disc pl-5 text-body">
                  {lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-muted-foreground">{copy.nothing}</p>
              )}
              <p className="text-caption text-muted-foreground">{copy.alsoMoves}</p>
            </section>
            <div className="flex flex-col gap-4">
              <h3 className="font-medium text-body">{copy.keepHeading}</h3>
              <MergeKeepChoice
                id="merge-keep-email"
                legend={copy.email}
                kept={customer.email}
                merged={other.email}
                value={keep.email}
                onChange={(email) => setKeep({ ...keep, email })}
              />
              <FieldDescription>{copy.emailHint}</FieldDescription>
              <MergeKeepChoice
                id="merge-keep-phone"
                legend={copy.phone}
                kept={customer.phone}
                merged={other.phone}
                value={keep.phone}
                onChange={(phone) => setKeep({ ...keep, phone })}
              />
              <MergeKeepChoice
                id="merge-keep-name"
                legend={copy.name}
                kept={customer.name}
                merged={other.name}
                value={keep.name}
                onChange={(name) => setKeep({ ...keep, name })}
              />
            </div>
          </>
        ) : null}
      </div>
    </FormDialog>
  )
}
