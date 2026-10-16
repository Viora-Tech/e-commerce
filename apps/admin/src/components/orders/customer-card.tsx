'use client'

import { Copy, Pencil, WhatsappLogo } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import CustomerAvatar from '@/components/customers/customer-avatar'
import CopyButton from '@/components/fields/copy-button'
import DataCard from '@/components/layout/data-card'
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
  const profileHref = order.customer ? `/customers/${order.customer.id}` : null
  const readOnly = Boolean(order.importedFrom)

  return (
    <DataCard
      title={c.heading}
      action={
        readOnly ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title={c.editHint}
            onClick={() => setEditing(true)}
          >
            <Pencil />
            {c.edit}
          </Button>
        )
      }
    >
      {/* Figma "Orders / Order detail" › Customer: who, then the fields one per line (label over
          value, a copy button each), Copy all for courier, and Call / WhatsApp at the bottom. */}
      <div className="flex flex-col gap-4 text-body">
        <div className="flex items-center gap-2.5">
          <CustomerAvatar
            name={name || null}
            email={order.email}
            className="size-8 bg-muted font-medium text-foreground"
          />
          <div className="flex min-w-0 flex-col">
            {profileHref ? (
              <Link
                href={profileHref}
                className="truncate font-medium text-ink-strong hover:underline"
              >
                {name || order.email}
              </Link>
            ) : (
              <span className="truncate font-medium text-ink-strong">{name || order.email}</span>
            )}
            {order.customer ? (
              order.customerOrderNumber > 0 && order.email ? (
                <Link
                  href={`${routes.orders.list()}?query=${encodeURIComponent(order.email)}`}
                  className="w-fit text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {c.orderCount(order.customerOrderNumber)}
                </Link>
              ) : null
            ) : (
              <span className="text-xs text-muted-foreground">{c.guest}</span>
            )}
          </div>
        </div>

        <DetailRows heading={c.contact} rows={contact} />
        {a ? (
          <DetailRows heading={c.address} rows={place} />
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">{c.address}</p>
            <p className="text-muted-foreground">{c.noAddress}</p>
          </div>
        )}
        {a ? <p className="text-xs text-muted-foreground">{c.billingSame}</p> : null}

        {order.buyerGstin ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">{c.business}</p>
            {order.buyerBusinessName ? <p>{order.buyerBusinessName}</p> : null}
            <div className="flex items-center gap-1">
              <span className="font-mono">{order.buyerGstin}</span>
              <CopyButton value={order.buyerGstin} what={c.gstin} visible />
            </div>
          </div>
        ) : null}
        {order.customerNote ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">{c.note}</p>
            <p className="whitespace-pre-line">{order.customerNote}</p>
          </div>
        ) : null}

        {allText ? (
          <div className="flex flex-col gap-1.5">
            <Button type="button" variant="outline" className="w-full" onClick={handleCopyAll}>
              <Copy />
              {c.copyAllCourier}
            </Button>
            <p className="text-xs text-muted-foreground">{c.copyAllHint}</p>
          </div>
        ) : null}
        {phone ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<a href={`tel:${phone}`} />}
              nativeButton={false}
            >
              {c.call}
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<a href={whatsappHref(phone)} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <WhatsappLogo />
              {c.whatsapp}
            </Button>
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

/** Figma field rows: the label 12px muted over the value, a copy button on the right; an empty
    field shows a dash and has nothing to copy. */
function DetailRows({ heading, rows }: DetailRowsProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{heading}</p>
      <dl className="-mx-2 flex flex-col">
        {rows.map((r) => (
          <div
            key={r.key}
            className="group/field flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-row-hover"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <dt className="text-xs text-muted-foreground">{r.label}</dt>
              <dd
                className={cn(
                  'min-w-0 text-[0.8125rem] text-ink-strong',
                  r.key === 'email' ? 'truncate' : 'break-words',
                )}
                title={r.key === 'email' ? (r.value ?? undefined) : undefined}
              >
                {r.value ? (
                  r.href ? (
                    <a href={r.href} className="hover:underline">
                      {r.value}
                    </a>
                  ) : (
                    r.value
                  )
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </dd>
            </div>
            {r.value ? <CopyButton value={r.value} what={r.label} visible /> : null}
          </div>
        ))}
      </dl>
    </div>
  )
}
