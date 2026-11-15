'use client'

import type { SocialChannel } from '@commerce/core/sales-channels'
import { InfoIcon } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
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
  /** Meta or Google is set up: the last step signs in there instead of asking. */
  connectNow: boolean
  onRequested: () => void
}

/** Figma "Connect Instagram / Facebook / WhatsApp / Google": account, catalog, then ask. */
export default function ConnectSocialDialog({
  open,
  onOpenChange,
  channel,
  activeProducts,
  connectNow,
  onRequested,
}: ConnectSocialDialogProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.socialConnect)
  const shared = useCopy(salesChannelsContent.connect)
  const info = useCopy(salesChannelsContent.social[channel])
  const live = useCopy(salesChannelsContent.live)
  const [at, setAt] = useState(0)
  const [account, setAccount] = useState('')
  const [all, setAll] = useState(true)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleNext = async () => {
    if (at < last) {
      setAt(at + 1)
      return
    }
    setBusy(true)
    try {
      const r = await api.salesChannels.connect({
        channel,
        shares: ['catalog', 'prices'],
        account: account.trim() || null,
        catalog: all ? 'all' : 'collections',
      })
      // Off to Facebook or Google to sign in; they send the merchant back to this page.
      if (r.kind === 'redirect') return window.location.assign(r.url)
      toast.success(r.kind === 'connected' ? live.joined(info.name) : shared.requested(info.name))
      onRequested()
      onOpenChange(false)
    } catch {
      toast.error(shared.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const provider = channel === 'google' ? 'google' : 'meta'
  // Signing in to the platform names the account, so that step is only for requests.
  const steps = connectNow
    ? [copy.steps.catalog, copy.steps.review]
    : [copy.steps.account, copy.steps.catalog, copy.steps.review]
  const last = steps.length - 1
  const step = connectNow ? at + 1 : at
  return (
    <ConnectSteps
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title(info.name)}
      intro={info.blurb}
      steps={steps}
      at={at}
      onBack={() => setAt(at - 1)}
      onNext={handleNext}
      submitLabel={connectNow ? live.continueWith[provider] : copy.submit(info.name)}
      busy={busy}
      nextDisabled={step === 0 && channel !== 'google' && account.trim() === ''}
    >
      {step === 0 ? (
        <Field>
          <FieldLabel htmlFor="channel-account">{copy.account[channel]}</FieldLabel>
          <Input
            id="channel-account"
            value={account}
            maxLength={120}
            onChange={(e) => setAccount(e.target.value)}
            autoComplete="off"
          />
          <FieldDescription>{copy.accountHint[channel]}</FieldDescription>
        </Field>
      ) : null}
      {step === 1 ? (
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
      {step === 2 ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            {connectNow
              ? provider === 'google'
                ? live.oauthNote.google
                : live.oauthNote.meta(info.name)
              : copy.review(info.name, info.partner)}
          </AlertDescription>
        </Alert>
      ) : null}
    </ConnectSteps>
  )
}
