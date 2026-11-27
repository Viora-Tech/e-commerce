'use client'

import { formatInZone } from '@commerce/dates'
import { CalendarIcon } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { gstInvoiceEditContent } from '@/data/gst-invoice-edit'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { filingReminder } from './invoice-edit-form'
import { monthRange } from './return-months'

/**
 * From the 1st to the 11th, on the Queue and Invoices pages: file last month's GSTR-1 by its
 * due date, then mark it filed; invoices of that month can be edited until then. Hidden once
 * the month is marked filed for the default GST number.
 */
export default function FilingReminder() {
  // Hooks
  const copy = useCopy(gstInvoiceEditContent.reminder)
  const [due] = useState(() => filingReminder())
  const [filed, setFiled] = useState<boolean | null>(null)

  useEffect(() => {
    if (!due) return
    let cancelled = false
    api.gstInvoices.periods
      .list()
      .then((rows) => {
        if (!cancelled) setFiled(rows.some((r) => r.period === due.period && r.gstr1FiledAt))
      })
      .catch(() => {
        if (!cancelled) setFiled(false)
      })
    return () => {
      cancelled = true
    }
  }, [due])

  // Early returns
  if (!due || filed !== false) return null

  // Render logic
  // "November": the reminder names the month alone, the year is plain from the date.
  const month = formatInZone(monthRange(due.period).to.getTime() - 86_400_000, { month: 'long' })
  const day = formatInZone(due.due, { day: 'numeric', month: 'short' })

  return (
    <Alert
      tone="info"
      action={
        <Link
          href={routes.apps.page('gst-invoices', 'reports')}
          className="text-body font-medium hover:underline"
        >
          {copy.returns}
        </Link>
      }
    >
      <CalendarIcon aria-hidden="true" />
      <AlertTitle>{copy.title(month, day)}</AlertTitle>
      <AlertDescription>{copy.body(month)}</AlertDescription>
    </Alert>
  )
}
