'use client'

import { Copy, Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import CustomerAvatar from '@/components/customers/customer-avatar'
import CopyButton from '@/components/fields/copy-button'
import ContactActions from '@/components/layout/contact-actions'
import DataCard from '@/components/layout/data-card'
import KeyValueList, { type KeyValueRow } from '@/components/layout/key-value-list'
import LabeledGroup from '@/components/layout/labeled-group'
import { stateName } from '@/data/india'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy } from '@/hooks/use-copy'
import { phoneForDisplay } from '@/lib/phone-display'
import { routes } from '@/lib/routes'
import EditOrderContactDialog from './edit-order-contact-dialog'
import type { OrderDetail } from './order-detail-types'

type CustomerCardProps = {
  order: OrderDetail
}

/**
 * Who ordered and where it goes, one field per line with its own copy button,
 * in the order courier apps ask for them. "Copy all" puts the same fields on
 * the clipboard one per line: name, phone, address, city, state, PIN code.
 */
type PostalAddress = {
  line1: string
  line2?: string | null
  city: string
  stateCode: string
  pincode: string
  /** ISO country; an address outside India names it (a courier abroad needs it). */
  country?: string | null
}

/** The country line of an address outside India; nothing for India. */
function countryLine(code: string | null | undefined): string | null {
  if (!code || code === 'IN') return null
  return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
}

/** An address as lines, as on a parcel. */
function linesOf(x: PostalAddress): string[] {
  return [
    x.line1,
    x.line2,
    `${x.city}, ${stateName(x.stateCode)} ${x.pincode}`,
    countryLine(x.country),
  ].filter((l): l is string => Boolean(l?.trim()))
}

type AddressBlockProps = { lines: string[]; what: string }

/** A postal address as lines, with one copy button for all of it. */
function AddressBlock({ lines, what }: AddressBlockProps) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="min-w-0 break-words">
        {lines.map((l) => (
          <span key={l} className="block">
            {l}
          </span>
        ))}
      </p>
      <CopyButton value={lines.join('\n')} what={what} visible />
    </div>
  )
}

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
  const contact: KeyValueRow[] = [
    { label: c.name, value: name, copy: true },
    {
      label: c.email,
      value: order.email ?? '',
      href: order.email ? `mailto:${order.email}` : undefined,
      copy: true,
    },
    {
      label: c.phone,
      value: phone ? phoneForDisplay(phone) : '',
      href: phone ? `tel:${phone}` : undefined,
      copy: true,
    },
  ]
  // An address reads as a block, as on a parcel: one row per labelled field made the card very
  // tall (audit #13). One copy button takes the whole address.
  const bill = order.billingAddress
  const billingLines = bill
    ? [bill.name, ...linesOf(bill), bill.phone].filter((l): l is string => Boolean(l?.trim()))
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
    countryLine(a?.country),
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

        <LabeledGroup label={c.contact}>
          <KeyValueList rows={contact} />
        </LabeledGroup>
        <LabeledGroup label={c.address}>
          {a ? (
            <AddressBlock lines={linesOf(a)} what={c.address} />
          ) : (
            <p className="text-muted-foreground">{c.noAddress}</p>
          )}
        </LabeledGroup>
        {bill ? (
          <LabeledGroup label={c.billingAddress}>
            <AddressBlock lines={billingLines} what={c.billingAddress} />
          </LabeledGroup>
        ) : a ? (
          <p className="text-xs text-muted-foreground">{c.billingSame}</p>
        ) : null}

        {order.buyerGstin ? (
          <LabeledGroup label={c.business}>
            {order.buyerBusinessName ? <p>{order.buyerBusinessName}</p> : null}
            <div className="flex items-center gap-1">
              <span className="font-mono">{order.buyerGstin}</span>
              <CopyButton value={order.buyerGstin} what={c.gstin} visible />
            </div>
          </LabeledGroup>
        ) : null}
        {order.customerNote ? (
          <LabeledGroup label={c.note}>
            <p className="whitespace-pre-line">{order.customerNote}</p>
          </LabeledGroup>
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
        <ContactActions
          phone={phone}
          layout="grid"
          chat={{ target: { kind: 'order', id: order.id }, onOpened: () => router.refresh() }}
        />
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
