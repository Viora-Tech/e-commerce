'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { useEffect, useState } from 'react'
import { orderCustomerContent } from '@/data/customer-merge'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type EmailOwnerOfferProps = {
  orderId: string
  /** The email as typed in the contact edit. */
  email: string
  /** The order's email before the edit: no offer while it is unchanged. */
  original: string | null
  checked: boolean
  /** A state setter: it must not change between renders (it is an effect dependency). */
  onChange: (checked: boolean) => void
}

type Owner = Awaited<ReturnType<typeof api.orders.findEmailOwner>>

const LOOKUP_DEBOUNCE_MS = 400
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * "This email belongs to <name>. Also move this order to them?" under the contact edit, when the
 * new email is another existing customer's. Unticked by default; customers are never merged.
 */
export default function EmailOwnerOffer({
  orderId,
  email,
  original,
  checked,
  onChange,
}: EmailOwnerOfferProps) {
  // Hooks
  const copy = useCopy(orderCustomerContent)
  const [owner, setOwner] = useState<Owner>(null)

  useEffect(() => {
    const typed = email.trim().toLowerCase()
    if (!LOOKS_LIKE_EMAIL.test(typed) || typed === (original ?? '').toLowerCase()) {
      setOwner(null)
      onChange(false)
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      api.orders
        .findEmailOwner({ orderId, email: typed })
        .then((found) => {
          if (cancelled) return
          setOwner(found)
          // A different person than the one ticked for: start unticked again.
          onChange(false)
        })
        .catch(() => {
          if (!cancelled) setOwner(null)
        })
    }, LOOKUP_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // onChange is the parent's state setter (stable), so the lookup follows the typed email.
  }, [email, original, orderId, onChange])

  // Early returns
  if (!owner) return null

  return (
    <Field orientation="horizontal">
      <Checkbox
        id="order-contact-move-to-owner"
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <div className="flex flex-col gap-0.5">
        <FieldLabel htmlFor="order-contact-move-to-owner">
          {copy.emailOwner(owner.name || owner.email || '')}
        </FieldLabel>
        <FieldDescription>{copy.emailOwnerHint}</FieldDescription>
      </div>
    </Field>
  )
}
