'use client'

import type { CustomerConsent } from '@commerce/core'
import { CONSENT_CHANNELS, type ConsentChannel } from '@commerce/core/privacy'
import { Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import DataCard from '@/components/layout/data-card'
import LogRequestDialog from '@/components/privacy/log-request-dialog'
import { CHANNEL_LABEL, consentCardContent as copy } from '@/data/customer-privacy'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'

type MarketingConsentCardProps = {
  customerId: string
  customerLabel: string
  onChanged: () => void
}

const HISTORY_SHOWN = 5

/** Per-channel marketing consent with its recent history, and the customer's privacy tools. */
export default function MarketingConsentCard({
  customerId,
  customerLabel,
  onChanged,
}: MarketingConsentCardProps) {
  // Hooks
  const [consent, setConsent] = useState<CustomerConsent | null>(null)
  const [saving, setSaving] = useState<ConsentChannel | null>(null)
  const [logging, setLogging] = useState(false)

  const [reload, setReload] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-fetches after a change
  useEffect(() => {
    api.customerPrivacy
      .consent({ customerId })
      .then(setConsent)
      .catch(() => setConsent(null))
  }, [customerId, reload])

  // Event handlers
  const handleToggle = async (channel: ConsentChannel, granted: boolean) => {
    setSaving(channel)
    try {
      await api.customerPrivacy.setConsent({ customerId, channel, granted })
      toast.success(copy.saved(CHANNEL_LABEL[channel], granted))
      setReload((n) => n + 1)
      onChanged()
    } catch {
      toast.error(copy.failed)
    } finally {
      setSaving(null)
    }
  }

  const handleExport = async () => {
    try {
      const file = await api.customerPrivacy.export({ customerId, format: 'json' })
      saveFile(new File([file.body], file.filename, { type: file.contentType }))
    } catch {
      toast.error(copy.failed)
    }
  }

  // Early returns
  if (!consent) return null

  // Render logic
  const recent = consent.history.slice(0, HISTORY_SHOWN)

  return (
    <DataCard title={copy.heading} className="rounded-xl">
      <p className="text-caption text-muted-foreground">{copy.body}</p>
      <div className="mt-3 flex flex-col gap-3">
        {CONSENT_CHANNELS.map((channel) => (
          <div key={channel} className="flex items-center justify-between gap-3">
            <Label htmlFor={`consent-${channel}`} className="text-body">
              {CHANNEL_LABEL[channel]}
            </Label>
            <Switch
              id={`consent-${channel}`}
              checked={consent.channels[channel]}
              disabled={saving !== null}
              onCheckedChange={(on) => handleToggle(channel, on)}
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
