'use client'

import type { SocialChannel } from '@commerce/core/sales-channels'
import { InfoIcon } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { toast } from 'sonner'
import ChoiceCard from '@/components/layout/choice-card'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ConnectSteps from './connect-steps'

type ConnectSocialDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel: SocialChannel
  activeProducts: number
  onRequested: () => void
}

/** Figma "Connect Instagram / Facebook / WhatsApp / Google": account, catalog, then ask. */
export default function ConnectSocialDialog({
  open,
  onOpenChange,
  channel,
  activeProducts,
  onRequested,
}: ConnectSocialDialogProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.socialConnect)
  const shared = useCopy(salesChannelsContent.connect)
  const info = useCopy(salesChannelsContent.social[channel])
  const [at, setAt] = useState(0)
  const [account, setAccount] = useState('')
  const [all, setAll] = useState(true)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleNext = async () => {
    if (at < 2) {
      setAt(at + 1)
      return
    }
    setBusy(true)
    try {
      await api.salesChannels.connect({
        channel,
        shares: ['catalog', 'prices'],
        account: account.trim() || null,
        catalog: all ? 'all' : 'collections',
      })
      toast.success(shared.requested(info.name))
      onRequested()
      onOpenChange(false)
    } catch {
      toast.error(shared.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <ConnectSteps
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title(info.name)}
      intro={info.blurb}
      steps={[copy.steps.account, copy.steps.catalog, copy.steps.review]}
      at={at}
      onBack={() => setAt(at - 1)}
      onNext={handleNext}
      submitLabel={copy.submit(info.name)}
      busy={busy}
      nextDisabled={at === 0 && channel !== 'google' && account.trim() === ''}
    >
      {at === 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="channel-account">{copy.account[channel]}</Label>
          <Input
            id="channel-account"
            value={account}
            maxLength={120}
            onChange={(e) => setAccount(e.target.value)}
            autoComplete="off"
          />
          <p className="text-caption text-muted-foreground">{copy.accountHint[channel]}</p>
        </div>
      ) : null}
      {at === 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-caption font-medium text-muted-foreground uppercase">
            {copy.catalogLabel(info.name)}
          </legend>
          <ChoiceCard
            layout="row"
            showCheck
            label={copy.all}
            description={copy.allBody(activeProducts)}
            selected={all}
            onSelect={() => setAll(true)}
          />
          <ChoiceCard
            layout="row"
            showCheck
            label={copy.chosen}
            description={copy.chosenBody(info.name)}
            selected={!all}
            onSelect={() => setAll(false)}
          />
        </fieldset>
      ) : null}
      {at === 2 ? (
        <p className="flex gap-2 rounded-md border border-border bg-muted/50 p-3 text-caption text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          {copy.review(info.name, info.partner)}
        </p>
      ) : null}
    </ConnectSteps>
  )
}
