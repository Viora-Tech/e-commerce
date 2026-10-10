'use client'

import { Copy, WhatsappLogo } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import CopyButton from '@/components/fields/copy-button'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { INDIAN_STATES } from '@/data/india'
import { orderDetailContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import EditOrderContactDialog from './edit-order-contact-dialog'
import type { OrderDetail } from './order-detail-types'

type CustomerCardProps = {
  order: OrderDetail
}

type Row = { key: string; label: string; value: string; href?: string | undefined }

/** wa.me wants digits only, with the country code: a bare 10-digit number is Indian. */
function whatsappHref(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '')
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`
}

const stateName = (code: string) => INDIAN_STATES.find((s) => s.code === code)?.name ?? code

/**
 * Who ordered and where it goes, one field per line with its own copy button,
 * in the order courier apps ask for them. "Copy all" puts the same fields on
 * the clipboard one per line: name, phone, address, city, state, PIN code.
 */
export default function CustomerCard({ order }: CustomerCardProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const router = useRouter()
  const [editing, setEditing] = useState(false)

  // Event handlers
  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(allText)
      toast.success(c.copied(c.allDetails))
    } catch {
      toast.error(c.copy(c.allDetails.toLowerCase()))
    }
  }

  // Render logic
  const c = copy.customer
  const a = order.shippingAddress
  const name = a?.name || order.customer?.name || ''
  const phone = order.phone || a?.phone || ''
  const contact: Row[] = [
    { key: 'name', label: c.name, value: name },
    {
      key: 'email',
      label: c.email,
      value: order.email ?? '',
      href: order.email ? `mailto:${order.email}` : undefined,
    },
    { key: 'phone', label: c.phone, value: phone, href: phone ? `tel:${phone}` : undefined },
  ]
  const place: Row[] = a
    ? [
        { key: 'line1', label: c.line1, value: a.line1 },
        ...(a.line2 ? [{ key: 'line2', label: c.line2, value: a.line2 }] : []),
        { key: 'city', label: c.city, value: a.city },
        { key: 'state', label: c.state, value: stateName(a.stateCode) },
        { key: 'pincode', label: c.pincode, value: a.pincode },
      ]
    : []
  // Courier-app order: name, phone, address, city, state, PIN code.
  const allText = [
    name,
    phone,
    a?.line1,
    a?.line2,
    a?.city,
    a ? stateName(a.stateCode) : '',
    a?.pincode,
  ]
    .filter((v): v is string => Boolean(v))
    .join('\n')
  const link =
    'text-[0.8125rem] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const profileHref = order.customer ? `/customers/${order.customer.id}` : null
  const readOnly = Boolean(order.importedFrom)

  return (
    <DataCard
      title={copy.customer.heading2}
      action={
        <div className="flex items-center gap-3">
          {order.email ? (
            <Link
              href={`${routes.orders.list()}?query=${encodeURIComponent(order.email)}`}
              className={link}
            >
              {c.viewOrders}
            </Link>
          ) : null}
          {profileHref ? (
            <Link href={profileHref} className={link}>
              {c.viewProfile}
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-5 text-body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusChip>
            {order.customer
              ? order.customerOrderNumber > 0
                ? c.orderCount(order.customerOrderNumber)
                : null
              : c.guest}
          </StatusChip>
          <div className="flex items-center gap-2">
            {allText ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                title={c.copyAllHint}
                onClick={handleCopyAll}
              >
                <Copy />
                {c.copyAll}
              </Button>
            ) : null}
            {readOnly ? null : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                title={c.editHint}
                onClick={() => setEditing(true)}
              >
                {c.edit}
              </Button>
            )}
          </div>
        </div>

        {phone ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<a href={whatsappHref(phone)} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <WhatsappLogo />
              {c.whatsapp}
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<a href={`tel:${phone}`} />}
              nativeButton={false}
            >
              {c.call}
            </Button>
          </div>
        ) : null}
        <DetailRows heading={c.contact} rows={contact} />
        {a ? (
          <DetailRows heading={c.address} rows={place} />
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-caption font-medium text-muted-foreground">{c.address}</p>
            <p className="text-muted-foreground">{c.noAddress}</p>
          </div>
        )}
        {a ? (
          <div className="flex flex-col gap-1">
            <p className="text-caption font-medium text-muted-foreground">{c.billing}</p>
            <p className="text-muted-foreground">{c.billingSame}</p>
          </div>
        ) : null}

        {order.buyerGstin ? (
          <div className="flex flex-col gap-1">
            <p className="text-caption font-medium text-muted-foreground">{c.business}</p>
            {order.buyerBusinessName ? <p>{order.buyerBusinessName}</p> : null}
            <div className="flex items-center gap-1">
              <span className="font-mono">{order.buyerGstin}</span>
              <CopyButton value={order.buyerGstin} what={c.gstin} visible />
            </div>
          </div>
        ) : null}
        {order.customerNote ? (
          <div className="flex flex-col gap-1">
            <p className="text-caption font-medium text-muted-foreground">{c.note}</p>
            <p className="whitespace-pre-line">{order.customerNote}</p>
          </div>
        ) : null}
      </div>

      {editing ? (
        <EditOrderContactDialog
          order={order}
          open
          onClose={() => setEditing(false)}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </DataCard>
  )
}

type DetailRowsProps = { heading: string; rows: Row[] }

/** A labelled list of fields; an empty field shows a dash and has nothing to copy. */
function DetailRows({ heading, rows }: DetailRowsProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-caption font-medium text-muted-foreground">{heading}</p>
      <dl className="flex flex-col">
        {rows.map((r) => (
          <div key={r.key} className="flex min-h-[2.125rem] items-center gap-3">
            <dt className="w-24 shrink-0 text-[0.8125rem] text-muted-foreground">{r.label}</dt>
            <dd
              className={cn(
                'min-w-0 font-medium text-ink-strong',
                r.key === 'email' ? 'truncate' : 'break-words',
              )}
              title={r.key === 'email' ? (r.value ?? undefined) : undefined}
            >
              {r.value ? (
                r.href ? (
                  <a href={r.href} className="hover:text-primary">
                    {r.value}
                  </a>
                ) : (
                  r.value
                )
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </dd>
            {r.value ? <CopyButton value={r.value} what={r.label} visible /> : null}
          </div>
        ))}
      </dl>
    </div>
  )
}
