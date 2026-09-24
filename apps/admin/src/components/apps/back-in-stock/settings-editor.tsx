'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
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
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          <Button disabled={busy} onClick={handleSave}>
            {copy.save}
          </Button>
        }
      />
      <DataCard title={copy.channels}>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="bis-email">{copy.emailEnabled}</Label>
            <Switch
              id="bis-email"
              checked={form.emailEnabled}
              onCheckedChange={(v) => setForm((f) => (f ? { ...f, emailEnabled: v } : f))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <Label htmlFor="bis-whatsapp">{copy.whatsappEnabled}</Label>
              <span className="text-caption text-muted-foreground">{copy.whatsappHelp}</span>
            </div>
            <Switch
              id="bis-whatsapp"
              checked={form.whatsappEnabled}
              onCheckedChange={(v) => setForm((f) => (f ? { ...f, whatsappEnabled: v } : f))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bis-batch">{copy.batchSize}</Label>
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
            <span className="text-caption text-muted-foreground">{copy.batchSizeHelp}</span>
          </div>
        </div>
      </DataCard>
    </div>
  )
}
