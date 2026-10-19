'use client'

import type { CustomerConsent } from '@commerce/core'
import { CONSENT_CHANNELS, type ConsentChannel } from '@commerce/core/privacy'
import { Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import { toast } from 'sonner'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import DataCard from '@/components/layout/data-card'
import LogRequestDialog from '@/components/privacy/log-request-dialog'
import { CHANNEL_LABEL, consentCardContent as copy } from '@/data/customer-privacy'
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
}

const HISTORY_SHOWN = 5

/**
 * Per-channel marketing consent with its recent history, and the customer's privacy tools.
 * A channel shows only when the store can send on it, or the customer already said yes to it
 * (so that yes can still be withdrawn).
 */
export default function MarketingConsentCard({
  customerId,
  customerLabel,
  consent,
  value,
  onChange,
}: MarketingConsentCardProps) {
  // Hooks
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

  // Render logic
  const channels = CONSENT_CHANNELS.filter(
    (c) => consent.sendable.includes(c) || consent.channels[c],
  )
  const recent = consent.history.slice(0, HISTORY_SHOWN)

  return (
    <DataCard title={copy.heading} className="rounded-xl">
      <p className="text-caption text-muted-foreground">{copy.body}</p>
      <div className="mt-3 flex flex-col gap-3">
        {channels.map((channel) => (
          <div key={channel} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Label htmlFor={`consent-${channel}`} className="text-body">
                {CHANNEL_LABEL[channel]}
              </Label>
              <span className="text-caption text-muted-foreground">{sourceLine(channel)}</span>
            </div>
            <Switch
              id={`consent-${channel}`}
              checked={value[channel]}
              onCheckedChange={(on) => onChange(channel, on)}
            />
          </div>
        ))}
      </div>
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
