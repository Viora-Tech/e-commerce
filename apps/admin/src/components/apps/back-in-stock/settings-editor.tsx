'use client'

import {
  ALERTS_PER_MINUTE_CHOICES,
  DEFAULT_NOTIFY_BUTTON_TEXT,
  NOTIFY_BUTTON_TEXTS,
  restockMinutes,
} from '@commerce/plugin-back-in-stock/settings-schema'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import LeaveGuard from '@/components/layout/leave-guard'
import { backInStockContent } from '@/data/back-in-stock'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import SelectField from './select-field'
import SettingsSection from './settings-section'
import ToggleField from './toggle-field'

type Settings = Awaited<ReturnType<typeof api.backInStock.settings.get>>

/** The restock size the "Alerts per minute" hint is worked out for (Figma: "500 signups"). */
const HINT_SIGNUPS = 500
/** The select cannot hold an empty value: the storefront-default button text is this key. */
const DEFAULT_KEY = 'default'

/** The per-minute choices, plus a stored value set elsewhere (the API) so it still shows. */
function paceOptions(current: number): number[] {
  const all = new Set<number>([...ALERTS_PER_MINUTE_CHOICES, current])
  return [...all].sort((a, b) => a - b)
}

/** The button text choices, plus a stored custom text so it still shows. */
function buttonTexts(current: string): string[] {
  const list: string[] = [...NOTIFY_BUTTON_TEXTS]
  return list.includes(current) ? list : [...list, current]
}

/**
 * Back in stock settings (Figma 928:12095): Channels, Sending and Storefront as two-column
 * sections, with Discard and Save in the page's own header instead of the floating save bar.
 * `unlimited` is a platform override and is not shown here.
 */
export default function SettingsEditor() {
  // Hooks
  const { settings: copy } = useCopy(backInStockContent)
  const [form, setForm] = useState<Settings | null>(null)
  const [saved, setSaved] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.backInStock.settings.get().then((s) => {
      setForm(s)
      setSaved(s)
    })
  }, [])

  // Helpers
  const patch = (next: Partial<Settings>) => setForm((f) => (f ? { ...f, ...next } : f))

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setBusy(true)
    try {
      // `unlimited` is dropped by the procedure's input schema; it is never set from here.
      const next = await api.backInStock.settings.save(form)
      setForm(next)
      setSaved(next)
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => setForm(saved)

  // Early returns
  if (!form) return null

  // Render logic
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const minutes = restockMinutes(HINT_SIGNUPS, form.batchSize)
  const paceItems = paceOptions(form.batchSize).map((n) => ({
    value: String(n),
    label: n.toLocaleString('en-IN'),
  }))
  const buttonItems = buttonTexts(form.buttonText).map((t) => ({
    value: t || DEFAULT_KEY,
    label: t || copy.buttonTextDefault(DEFAULT_NOTIFY_BUTTON_TEXT),
  }))

  return (
    <div className="flex flex-col gap-5">
      <LeaveGuard when={dirty && !busy} />
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-hairline border-b pb-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-[1.125rem] leading-6 font-semibold text-ink-strong">{copy.title}</h2>
          <p className="text-body text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={handleDiscard} disabled={!dirty || busy}>
            {copy.discard}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!dirty} loading={busy}>
            {busy ? copy.saving : copy.save}
          </Button>
        </div>
      </header>
      <div className="flex flex-col">
        <SettingsSection title={copy.channels} help={copy.channelsHelp}>
          <ToggleField
            id="bis-email"
            label={copy.emailEnabled}
            help={copy.emailHelp}
            checked={form.emailEnabled}
            onChange={(v) => patch({ emailEnabled: v })}
          />
          <ToggleField
            id="bis-whatsapp"
            label={copy.whatsappEnabled}
            help={copy.whatsappHelp}
            checked={form.whatsappEnabled}
            onChange={(v) => patch({ whatsappEnabled: v })}
          />
        </SettingsSection>
        <SettingsSection title={copy.sending} help={copy.sendingHelp}>
          <SelectField
            id="bis-batch"
            label={copy.batchSize}
            value={String(form.batchSize)}
            options={paceItems}
            onChange={(v) => patch({ batchSize: Number(v) })}
            help={copy.batchSizeHint(HINT_SIGNUPS, minutes)}
          />
        </SettingsSection>
        <SettingsSection title={copy.storefront} help={copy.storefrontHelp}>
          <SelectField
            id="bis-button-text"
            label={copy.buttonText}
            value={form.buttonText || DEFAULT_KEY}
            options={buttonItems}
            onChange={(v) => patch({ buttonText: v === DEFAULT_KEY ? '' : v })}
          />
          <ToggleField
            id="bis-ask-phone"
            label={copy.askPhone}
            help={copy.askPhoneHelp}
            checked={form.askPhone}
            onChange={(v) => patch({ askPhone: v })}
          />
        </SettingsSection>
      </div>
    </div>
  )
}
