'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { backInStockContent } from '@/data/back-in-stock'
import { api } from '@/lib/api-client'

type Settings = Awaited<ReturnType<typeof api.backInStock.settings.get>>

const copy = backInStockContent.settings

/** Channels, batch size and message copy. `unlimited` is a platform override and is not shown here. */
export default function SettingsEditor() {
  // Hooks
  const [form, setForm] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.backInStock.settings.get().then(setForm)
  }, [])

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setBusy(true)
    try {
      const saved = await api.backInStock.settings.save(form)
      setForm(saved)
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (!form) return null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={
          <Button loading={busy} onClick={handleSave}>
            {copy.save}
          </Button>
        }
      />
      <SettingsCard title={copy.channels}>
        <SettingsRow label={copy.emailEnabled} htmlFor="bis-email">
          <Switch
            id="bis-email"
            checked={form.emailEnabled}
            onCheckedChange={(v) => setForm((f) => (f ? { ...f, emailEnabled: v } : f))}
          />
        </SettingsRow>
        <SettingsRow
          label={copy.whatsappEnabled}
          description={copy.whatsappHelp}
          htmlFor="bis-whatsapp"
        >
          <Switch
            id="bis-whatsapp"
            checked={form.whatsappEnabled}
            onCheckedChange={(v) => setForm((f) => (f ? { ...f, whatsappEnabled: v } : f))}
          />
        </SettingsRow>
        <SettingsRow label={copy.batchSize} description={copy.batchSizeHelp} htmlFor="bis-batch">
          <Input
            id="bis-batch"
            type="number"
            min={1}
            max={2000}
            className="max-w-40"
            value={form.batchSize}
            onChange={(e) =>
              setForm((f) => (f ? { ...f, batchSize: Number(e.target.value) || 1 } : f))
            }
          />
        </SettingsRow>
      </SettingsCard>
    </div>
  )
}
