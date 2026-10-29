'use client'

import { WhatsappLogo } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { sendMessageContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'

/** Where a payment reminder goes; matches the API's `channel`. */
export type SendChannel = 'email' | 'whatsapp' | 'both'

type ReminderChannelPickerProps = {
  channel: SendChannel
  onChange: (channel: SendChannel) => void
  /** The order has an email / the store can WhatsApp the order's phone. Both: the choice shows. */
  canEmail: boolean
  canWhatsapp: boolean
  /** The wa.me chat with the reminder typed in, sent by hand; null without a usable phone. */
  chatHref: string | null
  onChatOpened: () => void
}

const isChannel = (v: unknown): v is SendChannel =>
  v === 'email' || v === 'whatsapp' || v === 'both'

/**
 * "Send by" Email / WhatsApp / Both for a payment reminder when the store can send both, and
 * "Open in WhatsApp" (the merchant's own chat, sent by hand) whenever the order has a phone,
 * whether or not the store has WhatsApp connected.
 */
export default function ReminderChannelPicker({
  channel,
  onChange,
  canEmail,
  canWhatsapp,
  chatHref,
  onChatOpened,
}: ReminderChannelPickerProps) {
  // Hooks
  const copy = useCopy(sendMessageContent)

  // Event handlers
  const handleChange = (next: unknown[]) => {
    const picked = next[0]
    if (isChannel(picked)) onChange(picked)
  }

  // Render logic
  const choose = canEmail && canWhatsapp

  return choose || chatHref ? (
    <div className="flex flex-col gap-3">
      {choose ? (
        <div className="flex flex-wrap items-center gap-3">
          <span id="reminder-channel-label" className="text-body font-medium text-foreground">
            {copy.sendBy}
          </span>
          <ToggleGroup
            aria-labelledby="reminder-channel-label"
            value={[channel]}
            onValueChange={handleChange}
            variant="outline"
            spacing={0}
          >
            <ToggleGroupItem value="email">{copy.email}</ToggleGroupItem>
            <ToggleGroupItem value="whatsapp">{copy.whatsapp}</ToggleGroupItem>
            <ToggleGroupItem value="both">{copy.both}</ToggleGroupItem>
          </ToggleGroup>
        </div>
      ) : null}
      {chatHref ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2">
          <p className="min-w-[min(100%,16rem)] flex-1 text-body text-muted-foreground">
            {canWhatsapp ? copy.chatHintConnected : copy.chatHint}
          </p>
          <Button
            variant="outline"
            render={<a href={chatHref} target="_blank" rel="noreferrer" />}
            nativeButton={false}
            onClick={onChatOpened}
          >
            <WhatsappLogo />
            {copy.openChat}
          </Button>
        </div>
      ) : null}
    </div>
  ) : null
}
