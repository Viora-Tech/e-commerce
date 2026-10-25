'use client'

import { Pencil, Send, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import RunAutomationDialog from '@/components/automations/records/run-automation-dialog'
import { useRunAutomation } from '@/components/automations/records/use-run-automation'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
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

type CustomerHeaderProps = {
  customer: CustomerDetail
  onEdit: () => void
  /** The Automations app is installed: "Run automation" and "Automation runs" in More actions. */
  automations?: boolean
}

/** Back link, avatar, name with its chips, a one-line summary, and the header actions. */
export default function CustomerHeader({
  customer,
  onEdit,
  automations = false,
}: CustomerHeaderProps) {
  // Hooks
  const copy = useCopy(customerDetailContent)
  const customersCopy = useCopy(customersContent)
  const dates = useCopy(datesContent)
  const locale = useLocale()
  const router = useRouter()
  const automation = useRunAutomation('customer', automations)
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
    <>
      <PageHeader
        title={title}
        summary={subtitle}
        back={{ label: copy.back, href: routes.customers.list() }}
        lead={{
          kind: 'avatar',
          node: (
            <CustomerAvatar
              name={customer.name}
              email={customer.email}
              className="size-10 text-body"
            />
          ),
        }}
        badges={
          <>
            {orderCount === 0 ? (
              <StatusChip tone="info">{copy.badges.new}</StatusChip>
            ) : orderCount > 1 ? (
              <StatusChip>{copy.badges.returning}</StatusChip>
            ) : null}
            {vip ? <StatusChip tone="info">{copy.badges.vip}</StatusChip> : null}
          </>
        }
        actions={
          <>
            {customer.email ? (
              <Button
                variant="outline"
                render={<a href={`mailto:${customer.email}`} />}
                nativeButton={false}
              >
                <Send />
                {copy.actions.email}
              </Button>
            ) : null}
            <ActionMenu
              label={copy.actions.more}
              trigger="button"
              items={[
                { label: copy.actions.edit, icon: Pencil, onSelect: onEdit },
                ...automation.items([customer.id], { runsLink: true }),
                {
                  label: copy.actions.delete,
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => setConfirming(true),
                },
              ]}
            />
          </>
        }
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.actions.deleteHeading}
        body={copy.actions.deleteBody}
        confirmLabel={copy.actions.confirm}
        cancelLabel={copy.actions.cancel}
        busy={busy}
        onConfirm={handleDelete}
      />
      <RunAutomationDialog
        subjectType="customer"
        ids={automation.target}
        onClose={automation.close}
        onDone={() => router.refresh()}
      />
    </>
  )
}
