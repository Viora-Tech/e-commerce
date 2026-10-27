'use client'

import type { CustomerConsent } from '@commerce/core'
import { CONSENT_CHANNELS, type ConsentChannel } from '@commerce/core/privacy'
import { Download, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import DataCard from '@/components/layout/data-card'
import LogRequestDialog from '@/components/privacy/log-request-dialog'
import { CHANNEL_LABEL, consentCardContent as copy } from '@/data/customer-privacy'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'

/** The consent API's answer: per-channel state, history, and the channels the store can send on. */
export type ConsentWithChannels = CustomerConsent & { sendable: readonly ConsentChannel[] }

type MarketingConsentCardProps = {
  customerId: string
  customerLabel: string
  consent: ConsentWithChannels
  /** The switches as edited; the page's save bar records them. */
  value: Record<ConsentChannel, boolean>
  onChange: (channel: ConsentChannel, granted: boolean) => void
  /** The customer has a contact phone; without one WhatsApp and SMS cannot be switched on. */
  hasPhone: boolean
  /** Shown under the phone channels when there is no phone: use the order's or add one. */
  phonePrompt: ReactNode
}

const HISTORY_SHOWN = 5

/** Channels that reach the customer's phone. */
const PHONE_CHANNELS: readonly ConsentChannel[] = ['whatsapp', 'sms']

/**
 * Per-channel marketing consent with its recent history, and the customer's privacy tools.
 * Every channel shows (a store that does not send on one yet says so), so a customer's yes
 * can be recorded or withdrawn. WhatsApp and SMS need a contact phone first; they stay off
 * until staff add one, and are never switched on automatically.
 */
export default function MarketingConsentCard({
  customerId,
  customerLabel,
  consent,
  value,
  onChange,
  hasPhone,
  phonePrompt,
}: MarketingConsentCardProps) {
  // Hooks
  const detail = useCopy(customerDetailContent)
  const [logging, setLogging] = useState(false)

  // Event handlers
  const handleExport = async () => {
    try {
      const file = await api.customerPrivacy.export({ customerId, format: 'json' })
      saveFile(new File([file.body], file.filename, { type: file.contentType }))
    } catch {
      toast.error(copy.failed)
    }
  }

  /** "Allowed at checkout": how the channel got its current state, from the newest matching event. */
  const sourceLine = (channel: ConsentChannel) => {
    if (!consent.channels[channel]) return copy.notAllowed
    const last = consent.history.find((h) => h.channel === channel && h.granted)
    if (!last) return copy.granted
    return `${copy.granted} ${copy.sources[last.source] ?? last.source}`
  }

  /** Off and locked while there is no phone; a yes already given can still be withdrawn. */
  const locked = (channel: ConsentChannel) =>
    !hasPhone && PHONE_CHANNELS.includes(channel) && !value[channel]

  // Render logic
  const recent = consent.history.slice(0, HISTORY_SHOWN)

  return (
    <DataCard title={copy.heading} className="rounded-xl">
      <p className="text-caption text-muted-foreground">{copy.body}</p>
      <div className="mt-3 flex flex-col gap-3">
        {CONSENT_CHANNELS.map((channel) => (
          <div key={channel} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Label htmlFor={`consent-${channel}`} className="text-body">
                {CHANNEL_LABEL[channel]}
              </Label>
              <span className="text-caption text-muted-foreground">{sourceLine(channel)}</span>
              {consent.sendable.includes(channel) ? null : (
                <span className="text-caption text-muted-foreground">
                  {detail.contactPhone.notSendable}
                </span>
              )}
            </div>
            <Switch
              id={`consent-${channel}`}
              checked={value[channel]}
              disabled={locked(channel)}
              onCheckedChange={(on) => onChange(channel, on)}
            />
          </div>
        ))}
      </div>
      {hasPhone ? null : (
        <div className="mt-3 flex flex-col gap-2 rounded-lg bg-muted p-3">
          <p className="text-caption text-muted-foreground">
            {detail.contactPhone.consentNeedsPhone}
          </p>
          {phonePrompt}
        </div>
      )}
      <p className="mt-3 text-caption text-muted-foreground">{copy.record}</p>
      {consent.unsubscribedAt ? (
        <p className="mt-2 text-caption text-muted-foreground">{copy.unsubscribed}</p>
      ) : null}
      <div className="mt-4 border-t border-border pt-4">
        <p className="text-eyebrow">{copy.history}</p>
        {recent.length === 0 ? (
          <p className="mt-1 text-caption text-muted-foreground">{copy.noHistory}</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {recent.map((h) => (
              <li key={h.id} className="text-caption">
                {CHANNEL_LABEL[h.channel]}: {h.granted ? copy.granted : copy.withdrawn}
                <span className="text-muted-foreground">
                  {' '}
                  ({copy.sources[h.source] ?? h.source}, {formatDate(new Date(h.createdAt))})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-eyebrow">{copy.privacy}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download aria-hidden="true" />
            {copy.exportJson}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLogging(true)}>
            <Plus aria-hidden="true" />
            {copy.logRequest}
          </Button>
        </div>
      </div>
      <LogRequestDialog
        open={logging}
        customer={{ id: customerId, label: customerLabel }}
        onClose={() => setLogging(false)}
        onLogged={() => setLogging(false)}
      />
    </DataCard>
  )
}
