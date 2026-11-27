'use client'

import { ChevronDown } from '@commerce/ui/icons'
import Link from 'next/link'
import { useState } from 'react'
import { gstInvoiceEditContent } from '@/data/gst-invoice-edit'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type OrderCardChangesProps = {
  invoiceId: string
  /** Reported in a filed GSTR-1: only a credit note or a new invoice changes it now. */
  reported: boolean
}

/**
 * "Need to change this invoice?" under the order's issued invoice. Until its month's GSTR-1 is
 * filed or due it can be edited in place (Edit invoice on the invoice page, 28 Nov 2026); after
 * that corrections go through a credit note or a fresh invoice (CGST Act s.34), so this says
 * which applies and points at the ways the app has.
 */
export default function OrderCardChanges({ invoiceId, reported }: OrderCardChangesProps) {
  // Hooks
  const copy = useCopy(gstInvoicesContent.orderCard.changes)
  const editCopy = useCopy(gstInvoiceEditContent.panel)
  const [open, setOpen] = useState(false)
  /** Whether Edit invoice is allowed now; read when the panel first opens. */
  const [editable, setEditable] = useState<boolean | null>(null)

  // Event handlers
  const handleToggle = () => {
    setOpen((v) => !v)
    if (editable === null && !reported) {
      api.gstInvoices
        .getEdit({ id: invoiceId })
        .then((r) => setEditable(r.lock.editable))
        .catch(() => setEditable(false))
    }
  }

  // Render logic
  const canEdit = editable === true && !reported
  const steps = canEdit ? editCopy.steps : reported ? copy.reported : copy.open

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
          {editable === null && !reported ? null : <p>{canEdit ? editCopy.body : copy.body}</p>}
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
