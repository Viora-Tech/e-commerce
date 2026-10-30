'use client'

import { ChevronDown } from '@commerce/ui/icons'
import Link from 'next/link'
import { useState } from 'react'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { routes } from '@/lib/routes'

type OrderCardChangesProps = {
  invoiceId: string
  /** Reported in a filed GSTR-1: only a credit note or a new invoice changes it now. */
  reported: boolean
}

const copy = gstInvoicesContent.orderCard.changes

/**
 * "Need to change this invoice?" under the order's issued invoice: an issued tax invoice is
 * never edited (CGST Act s.34: corrections go through a credit note or a fresh invoice), so
 * this says why and points at the ways the app already has.
 */
export default function OrderCardChanges({ invoiceId, reported }: OrderCardChangesProps) {
  // Hooks
  const [open, setOpen] = useState(false)

  // Event handlers
  const handleToggle = () => setOpen((v) => !v)

  // Render logic
  const steps = reported ? copy.reported : copy.open

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={handleToggle}
        className="flex items-center gap-1 self-start text-caption font-medium text-muted-foreground hover:text-foreground"
      >
        {copy.toggle}
        <ChevronDown
          className={`size-3.5 transition-[rotate] duration-200 ease-out ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-2 rounded-[0.5rem] bg-secondary p-2.5 text-caption">
          <p>{copy.body}</p>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-muted-foreground">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <Link
            href={routes.apps.page('gst-invoices', 'invoices', invoiceId)}
            className="self-start font-medium hover:underline"
          >
            {copy.openInvoice}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
