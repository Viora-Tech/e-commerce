'use client'

import { Phone, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { spacedMobile } from '@/lib/customer-contact'
import { routes } from '@/lib/routes'
import type { CustomerDetail } from './customer-detail-types'

type ContactPhonePromptProps = {
  customerId: string
  suggestion: CustomerDetail['phoneSuggestion']
  /** Opens the edit dialog to type a number. */
  onAdd: () => void
  /** The phone was saved; the page reloads the customer. */
  onSaved: () => void
}

/**
 * For a customer with no contact phone: one click to use the mobile from their latest order (or
 * saved address), a note when another customer already has that number, or "Add phone".
 * Saving the number never switches marketing consent on.
 */
export default function ContactPhonePrompt({
  customerId,
  suggestion,
  onAdd,
  onSaved,
}: ContactPhonePromptProps) {
  // Hooks
  const detail = useCopy(customerDetailContent)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleUse = async () => {
    setSaving(true)
    try {
      await api.customers.adoptContactPhone({ id: customerId })
      toast.success(detail.contactPhone.saved)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : detail.contactPhone.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const c = detail.contactPhone
  const phone = suggestion ? spacedMobile(suggestion.phone) : null
  const offer = suggestion && !suggestion.takenBy && phone

  return (
    <div className="flex flex-col items-start gap-2">
      {offer ? (
        <Button type="button" variant="outline" size="sm" onClick={handleUse} disabled={saving}>
          <Phone aria-hidden="true" />
          {suggestion.source === 'order' ? c.takeFromOrder(phone) : c.takeFromAddress(phone)}
        </Button>
      ) : null}
      {suggestion?.takenBy && phone ? (
        <p className="text-caption text-muted-foreground">
          {c.taken(phone)}{' '}
          <Link
            href={routes.customers.detail(suggestion.takenBy)}
            className="text-foreground underline-offset-4 hover:underline"
          >
            {c.openOther}
          </Link>
        </p>
      ) : null}
      <Button type="button" variant="ghost" size="sm" onClick={onAdd} disabled={saving}>
        <Plus aria-hidden="true" />
        {c.add}
      </Button>
    </div>
  )
}
