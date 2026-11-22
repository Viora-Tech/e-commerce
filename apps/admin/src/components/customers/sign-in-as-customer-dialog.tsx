'use client'

import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { customerSignInAsContent } from '@/data/customer-sign-in-as'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type SignInAsCustomerDialogProps = {
  customerId: string
  /** Name or email; null for a customer with neither. */
  name: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** After the link is made: the page refreshes so the timeline shows the sign-in. */
  onSignedIn: () => void
}

/**
 * The confirm for "Sign in as customer". The new tab opens on the click, before the link is
 * fetched, so the browser does not block it as a pop-up; it then goes to the single-use link
 * that signs it in to the store as the customer for an hour.
 */
export default function SignInAsCustomerDialog({
  customerId,
  name,
  open,
  onOpenChange,
  onSignedIn,
}: SignInAsCustomerDialogProps) {
  // Hooks
  const copy = useCopy(customerSignInAsContent)

  // Event handlers
  const handleConfirm = async () => {
    const tab = window.open('', '_blank')
    const result = await api.customers.signInAs({ id: customerId }).catch(() => null)
    if (!result) {
      tab?.close()
      toast.error(copy.failed)
      return
    }
    onSignedIn()
    if (!tab) {
      window.open(result.url, '_blank', 'noopener')
      return
    }
    tab.opener = null
    tab.location.href = result.url
  }

  // Render logic
  return (
    <ConfirmDialog
      tone="default"
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      body={copy.body(name ?? copy.unnamed)}
      confirmLabel={copy.confirm}
      cancelLabel={copy.cancel}
      onConfirm={handleConfirm}
    />
  )
}
