'use client'

import { Pencil, Send, Trash2 } from '@commerce/ui/icons'
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
import ActionMenu from '@/components/layout/action-menu'
import StatusChip from '@/components/layout/status-chip'
import { customerDetailContent, customersContent, VIP_SPEND_PAISE } from '@/data/customers'
import { datesContent } from '@/data/dates'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatDay } from '@/lib/format-date'
import { routes } from '@/lib/routes'
import CustomerAvatar from './customer-avatar'
import type { CustomerDetail } from './customer-detail-types'
import { day } from './customer-detail-types'
import CustomersBackLink from './customers-back-link'

type CustomerHeaderProps = {
  customer: CustomerDetail
  onEdit: () => void
}

/** Back link, avatar, name with its chips, a one-line summary, and the header actions. */
export default function CustomerHeader({ customer, onEdit }: CustomerHeaderProps) {
  // Hooks
  const copy = useCopy(customerDetailContent)
  const customersCopy = useCopy(customersContent)
  const dates = useCopy(datesContent)
  const locale = useLocale()
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
      router.push(routes.customers.list())
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  // Render logic
  const title = customer.name ?? customer.email ?? customersCopy.unnamed
  const orderCount = customer.totals.orderCount
  const vip = customer.totals.spentPaise >= VIP_SPEND_PAISE
  const created = formatDay(customer.createdAt, new Date(), locale)
  const since =
    created === dates.today
      ? copy.sinceToday
      : created === dates.yesterday
        ? copy.sinceYesterday
        : copy.since(day(customer.createdAt, locale))
  const city = customer.defaultAddress?.city ?? customer.addresses[0]?.city
  const subtitle = city ? copy.withCity(since, city) : since

  return (
    <div className="flex flex-col gap-3">
      <CustomersBackLink href={routes.customers.list()} label={copy.back} />
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <CustomerAvatar
            name={customer.name}
            email={customer.email}
            className="size-10 text-body"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="truncate text-page-title text-ink-strong">{title}</h1>
              <div className="flex items-center gap-1.5">
                {orderCount === 0 ? (
                  <StatusChip tone="info">{copy.badges.new}</StatusChip>
                ) : orderCount > 1 ? (
                  <StatusChip>{copy.badges.returning}</StatusChip>
                ) : null}
                {vip ? <StatusChip tone="info">{copy.badges.vip}</StatusChip> : null}
              </div>
            </div>
            <p className="text-body text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {customer.email ? (
            <Button
              variant="key-neutral"
              render={<a href={`mailto:${customer.email}`} />}
              nativeButton={false}
            >
              <Send />
              {copy.actions.email}
            </Button>
          ) : null}
          <ActionMenu
            label={copy.actions.more}
            variant="outline"
            size="md"
            items={[
              { label: copy.actions.edit, icon: Pencil, onSelect: onEdit },
              {
                label: copy.actions.delete,
                icon: Trash2,
                destructive: true,
                onSelect: () => setConfirming(true),
              },
            ]}
          />
        </div>
      </div>
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
    </div>
  )
}
