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
  /** A store without WhatsApp: the wa.me chat with the reminder typed in, sent by hand. */
  chatHref: string | null
  onChatOpened: () => void
}

const isChannel = (v: unknown): v is SendChannel =>
  v === 'email' || v === 'whatsapp' || v === 'both'

/**
 * "Send by" Email / WhatsApp / Both for a payment reminder when the store can send both, or
 * "Open in WhatsApp" when it has no WhatsApp channel but the order has a phone.
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

  // Early returns
  // WhatsApp only (no email on the order): nothing to choose.
  if (canWhatsapp && !canEmail) return null
  if (!canWhatsapp && !chatHref) return null

  // Render logic
  const choose = canEmail && canWhatsapp

  return choose ? (
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
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2">
      <p className="min-w-[min(100%,16rem)] flex-1 text-body text-muted-foreground">
        {copy.chatHint}
      </p>
      <Button
        variant="outline"
        render={<a href={chatHref ?? undefined} target="_blank" rel="noreferrer" />}
        nativeButton={false}
        onClick={onChatOpened}
      >
        <WhatsappLogo />
        {copy.openChat}
      </Button>
    </div>
  )
}
