'use client'

import {
  type LoyaltySettings,
  REFERRAL_SHARE_CHANNELS,
  type ReferralShareChannel,
} from '@commerce/core/loyalty'
import { FacebookLogo, Inbox, MessageSquare, Send, WhatsappLogo } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import type { ReactNode } from 'react'
import DataCard from '@/components/layout/data-card'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import ReferralFraudCard from './referral-fraud-card'
import ReferralPartyCard from './referral-party-card'
import ReferralPopupCard from './referral-popup-card'

type Referrals = LoyaltySettings['referrals']

type ReferralsTabProps = {
  referrals: Referrals
  /** Customize › App embeds on the live theme (the referral pop-up); null without a theme. */
  popupHref: string | null
  onChange: (referrals: Referrals) => void
}

/** A letter tile for the channels with no glyph in the icon set. */
const letter = (s: string) => (
  <span className="flex size-4 items-center justify-center text-caption font-bold">{s}</span>
)

const ICON: Record<ReferralShareChannel, ReactNode> = {
  whatsapp: <WhatsappLogo className="size-4" />,
  email: <Inbox className="size-4" />,
  x: letter('X'),
  facebook: <FacebookLogo className="size-4" />,
  messenger: <MessageSquare className="size-4" />,
  threads: letter('@'),
  telegram: <Send className="size-4" />,
}

/**
 * The Referrals part of the Program page (Essential Loyalty's layout): a banner while it is
 * off; the referring member and the referred friend, share buttons and fraud checks on the
 * left; the referral pop-up on the right.
 */
export default function ReferralsTab({ referrals, popupHref, onChange }: ReferralsTabProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)

  // Helpers
  const set = (patch: Partial<Referrals>) => onChange({ ...referrals, ...patch })

  // Event handlers
  const handleChannel = (channel: ReferralShareChannel, on: boolean) =>
    set({
      shareChannels: REFERRAL_SHARE_CHANNELS.filter((c) =>
        c === channel ? on : referrals.shareChannels.includes(c),
      ),
    })

  // Render logic
  const c = copy.referrals

  return (
    <div className="flex flex-col gap-5">
      {referrals.enabled ? null : (
        <Alert
          tone="warning"
          action={
            <Button size="sm" onClick={() => set({ enabled: true })}>
              {c.enable}
            </Button>
          }
        >
          <AlertTitle>{c.offTitle}</AlertTitle>
          <AlertDescription>{c.offBody}</AlertDescription>
        </Alert>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <ReferralPartyCard side="referrer" referrals={referrals} onChange={set} />
          <ReferralPartyCard side="friend" referrals={referrals} onChange={set} />
          <DataCard title={c.share} subtitle={c.shareHelp}>
            <div className="grid gap-3 sm:grid-cols-2">
              {REFERRAL_SHARE_CHANNELS.map((channel) => (
                <Field key={channel} orientation="horizontal">
                  <Checkbox
                    id={`share-${channel}`}
                    checked={referrals.shareChannels.includes(channel)}
                    onCheckedChange={(on) => handleChannel(channel, Boolean(on))}
                  />
                  <FieldLabel
                    htmlFor={`share-${channel}`}
                    className="flex items-center gap-2 font-normal"
                  >
                    <span className="text-muted-foreground">{ICON[channel]}</span>
                    {c.channels[channel]}
                  </FieldLabel>
                </Field>
              ))}
            </div>
          </DataCard>
          <ReferralFraudCard />
        </div>
        <div className="min-w-0 lg:sticky lg:top-4">
          <ReferralPopupCard friendReward={referrals.friendReward} editHref={popupHref} />
        </div>
      </div>
    </div>
  )
}
