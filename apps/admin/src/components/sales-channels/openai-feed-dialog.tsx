'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type OpenAiFeedDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** ChatGPT after OpenAI approved the store: their feed address and key, then the first sync. */
export default function OpenAiFeedDialog({ open, onOpenChange }: OpenAiFeedDialogProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.live)
  const router = useRouter()
  const [endpoint, setEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setBusy(true)
    try {
      await api.salesChannels.saveOpenAiFeed({ endpoint: endpoint.trim(), apiKey: apiKey.trim() })
      toast.success(copy.openai.saved)
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.openai.title}
      description={copy.openai.intro}
      submitLabel={copy.openai.save}
      busy={busy}
      submitDisabled={!endpoint.trim().startsWith('https://') || apiKey.trim().length < 8}
      onSubmit={handleSave}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="openai-endpoint">{copy.openai.endpoint}</Label>
          <Input
            id="openai-endpoint"
            type="url"
            value={endpoint}
            placeholder="https://"
            onChange={(e) => setEndpoint(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="openai-key">{copy.openai.key}</Label>
          <Input
            id="openai-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>
    </FormDialog>
  )
}
