'use client'

import { FieldDescription } from '@commerce/ui/shadcn/field'
import { useState } from 'react'
import { toast } from 'sonner'
import CustomerPicker, { type PickedCustomer } from '@/components/customers/customer-picker'
import FormDialog from '@/components/layout/form-dialog'
import { orderCustomerContent } from '@/data/customer-merge'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { OrderDetail } from './order-detail-types'

type ChangeCustomerDialogProps = {
  order: OrderDetail
  open: boolean
  onClose: () => void
  onChanged: () => void
}

/** Order page › Customer › "Change customer": move this order to another existing customer. */
export default function ChangeCustomerDialog({
  order,
  open,
  onClose,
  onChanged,
}: ChangeCustomerDialogProps) {
  // Hooks
  const copy = useCopy(orderCustomerContent)
  const [picked, setPicked] = useState<PickedCustomer | null>(null)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (next) return
    setPicked(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (!picked) return
    setSaving(true)
    try {
      await api.orders.changeCustomer({ orderId: order.id, customerId: picked.id })
      toast.success(copy.done)
      handleOpenChange(false)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const current = order.customer
    ? copy.current(order.customer.name || order.email || '')
    : copy.guest

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.title}
      description={copy.body}
      submitLabel={copy.confirm}
      cancelLabel={copy.cancel}
      busy={saving}
      submitDisabled={!picked}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-4">
        <FieldDescription>{current}</FieldDescription>
        <CustomerPicker
          id="order-change-customer"
          exceptId={order.customer?.id}
          value={picked}
          onPick={setPicked}
        />
      </div>
    </FormDialog>
  )
}
