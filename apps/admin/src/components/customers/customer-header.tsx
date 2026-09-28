'use client'

import { Send, Trash2 } from '@commerce/ui/icons'
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
import PageHeader from '@/components/layout/page-header'
import StatusLabel from '@/components/status/status-label'
import { customerDetailContent as copy, customersContent } from '@/data/customers'
import { api } from '@/lib/api-client'
import type { CustomerDetail } from './customer-detail-types'
import { day } from './customer-detail-types'

type CustomerHeaderProps = {
  customer: CustomerDetail
  onEdit: () => void
}

/** Lifetime spend at or above this counts as VIP until the store can configure it. */
const VIP_SPEND_PAISE = 2_000_000

export default function CustomerHeader({ customer, onEdit }: CustomerHeaderProps) {
  // Hooks
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    setBusy(true)
    try {
      const result = await api.customers.delete({ id: customer.id })
      if (!result.deleted) {
        toast.error(copy.actions.deleteBlocked(result.orders))
        return
      }
      toast.success(copy.actions.deleted)
      router.push('/customers')
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  // Render logic
  const title = customer.name ?? customer.email ?? customersContent.unnamed
  const returning = customer.totals.orderCount > 1
  const vip = customer.totals.spentPaise >= VIP_SPEND_PAISE

  return (
    <>
      <PageHeader
        title={title}
        subtitle={copy.since(day(customer.createdAt))}
        breadcrumbs={[{ label: copy.back, href: '/customers' }, { label: title }]}
        actions={
          <>
            {returning ? <StatusLabel kind="customer" value="returning" variant="pill" /> : null}
            {vip ? <StatusLabel kind="customer" value="vip" variant="pill" /> : null}
            <Button variant="outline" size="sm" onClick={onEdit}>
              {copy.actions.edit}
            </Button>
            {customer.email ? (
              <Button
                variant="outline"
                size="sm"
                render={<a href={`mailto:${customer.email}`} />}
                nativeButton={false}
              >
                <Send />
                {copy.actions.email}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirming(true)}
              aria-label={copy.actions.delete}
            >
              <Trash2 />
            </Button>
          </>
        }
      />
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.actions.deleteHeading}</AlertDialogTitle>
            <AlertDialogDescription>{copy.actions.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={handleDelete}>
              {copy.actions.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
