'use client'

import { MessageSquare } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { toast } from 'sonner'
import { paymentsSetupContent as copy } from '@/data/payments-setup'

/** WhatsApp help, a placeholder until the support number is live. */
export default function HelpFooter() {
  // Event handlers
  const handleHelp = () => toast.info(copy.whatsapp.soon)

  return (
    <div className="flex justify-center">
      <Button variant="ghost" className="gap-2" onClick={handleHelp}>
        <MessageSquare aria-hidden="true" className="size-4" />
        {copy.whatsapp.label}
      </Button>
    </div>
  )
}
