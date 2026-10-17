'use client'

import { Phone, WhatsappLogo } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { contactContent } from '@/data/common'
import { useCopy } from '@/hooks/use-copy'
import { telUrl, whatsappUrl } from '@/lib/customer-contact'

type ContactActionsProps = {
  phone: string | null | undefined
  /** grid: two equal buttons filling the card; row: buttons side by side. */
  layout?: 'grid' | 'row'
  className?: string
}

/** Call and WhatsApp buttons for a customer's phone; nothing when there is no number. */
export default function ContactActions({ phone, layout = 'row', className }: ContactActionsProps) {
  // Hooks
  const copy = useCopy(contactContent)

  // Render logic
  const call = telUrl(phone)
  const chat = whatsappUrl(phone)
  if (!call && !chat) return null

  return (
    <div
      className={cn(
        layout === 'grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2',
        className,
      )}
    >
      {call ? (
        <Button variant="outline" size="sm" render={<a href={call} />} nativeButton={false}>
          <Phone />
          {copy.call}
        </Button>
      ) : null}
      {chat ? (
        <Button
          variant="outline"
          size="sm"
          render={<a href={chat} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          <WhatsappLogo />
          {copy.whatsapp}
        </Button>
      ) : null}
    </div>
  )
}
