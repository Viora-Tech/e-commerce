'use client'

import { Phone, WhatsappLogo } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { contactContent } from '@/data/common'
import { useCopy } from '@/hooks/use-copy'
import { telUrl, whatsappUrl } from '@/lib/customer-contact'
import type { WhatsappChatTarget } from '@/lib/whatsapp-chat'
import WhatsappChatDialog from './whatsapp-chat-dialog'

type ContactActionsProps = {
  phone: string | null | undefined
  /** grid: two equal buttons filling the card; row: buttons side by side. */
  layout?: 'grid' | 'row'
  className?: string
  /**
   * What the WhatsApp chat is about: the button then opens the click-to-chat dialog (pick and
   * edit a message, noted on the timeline) instead of an empty chat.
   */
  chat?: { target: WhatsappChatTarget; onOpened?: () => void } | undefined
}

/** Call and WhatsApp buttons for a customer's phone; nothing when there is no number. */
export default function ContactActions({
  phone,
  layout = 'row',
  className,
  chat,
}: ContactActionsProps) {
  // Hooks
  const copy = useCopy(contactContent)
  const [chatting, setChatting] = useState(false)

  // Render logic
  const call = telUrl(phone)
  const wa = whatsappUrl(phone)
  if (!call && !wa) return null

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
      {wa && chat ? (
        <Button variant="outline" size="sm" onClick={() => setChatting(true)}>
          <WhatsappLogo />
          {copy.whatsapp}
        </Button>
      ) : wa ? (
        <Button
          variant="outline"
          size="sm"
          render={<a href={wa} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          <WhatsappLogo />
          {copy.whatsapp}
        </Button>
      ) : null}
      {chat ? (
        <WhatsappChatDialog
          open={chatting}
          kind={chat.target.kind}
          id={chat.target.id}
          onClose={() => setChatting(false)}
          onOpened={chat.onOpened}
        />
      ) : null}
    </div>
  )
}
