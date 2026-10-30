'use client'

import {
  REQUEST_CHANNELS,
  type RequestChannel,
  REVIEW_SORTS,
  type ReviewSort,
  type ReviewsSettings,
  requestSubject,
} from '@commerce/plugin-reviews/settings'
import { Eye } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { Label } from '@commerce/ui/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { reviewToolsContent } from '@/data/review-tools'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'

type ShowSettingsProps = {
  value: ReviewsSettings
  storeName: string
  onChange: (patch: Partial<ReviewsSettings>) => void
}

const days = (raw: string) => Math.min(60, Math.max(0, Math.round(Number(raw) || 0)))

/** Right column of Review settings: the review request email and what the store shows. */
export default function ShowSettings({ value, storeName, onChange }: ShowSettingsProps) {
  // Hooks
  const { settings: copy } = useCopy(reviewsContent)
  const { channel: channelCopy } = useCopy(reviewToolsContent)
  const [previewing, setPreviewing] = useState(false)

  // Helpers
  const email = (patch: Partial<ReviewsSettings['requestEmail']>) =>
    onChange({ requestEmail: { ...value.requestEmail, ...patch } })
  const store = (patch: Partial<ReviewsSettings['storefront']>) =>
    onChange({ storefront: { ...value.storefront, ...patch } })

  // Render logic
  const e = copy.email
  const sorts = Object.fromEntries(REVIEW_SORTS.map((s) => [s, copy.store.sorts[s]]))
  const channels = Object.fromEntries(REQUEST_CHANNELS.map((c) => [c, channelCopy.options[c]]))

  return (
    <>
      <DataCard title={e.title}>
        <div className="flex flex-col gap-4">
          <span className="text-caption text-muted-foreground">{e.help}</span>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="reviews-email-on">{e.enabled}</Label>
            <Switch
              id="reviews-email-on"
              checked={value.requestEmail.enabled}
              onCheckedChange={(v) => email({ enabled: v })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reviews-channel">{channelCopy.label}</Label>
            <Select
              items={channels}
              value={value.requestEmail.channel}
              onValueChange={(v) => email({ channel: v as RequestChannel })}
            >
              <SelectTrigger id="reviews-channel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {channelCopy.options[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {value.requestEmail.channel !== 'email' && (
              <span className="text-caption text-muted-foreground">{channelCopy.whatsappHelp}</span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reviews-after">{e.after}</Label>
              <InputGroup>
                <InputGroupInput
                  id="reviews-after"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={60}
                  value={value.requestEmail.daysAfterDelivery}
                  onChange={(ev) => email({ daysAfterDelivery: days(ev.target.value) })}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{e.days}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reviews-reminder">{e.reminder}</Label>
              <InputGroup>
                <InputGroupInput
                  id="reviews-reminder"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={60}
                  value={value.requestEmail.reminderDays}
                  onChange={(ev) => email({ reminderDays: days(ev.target.value) })}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{e.days}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <span className="text-caption text-muted-foreground">{e.reminderHelp}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reviews-subject">{e.subject}</Label>
            <Input
              id="reviews-subject"
              value={value.requestEmail.subject}
              maxLength={150}
              onChange={(ev) => email({ subject: ev.target.value })}
            />
            <span className="text-caption text-muted-foreground">{e.subjectHelp}</span>
          </div>
          <Button variant="outline" className="self-end" onClick={() => setPreviewing(true)}>
            <Eye aria-hidden="true" />
            {e.preview}
          </Button>
        </div>
      </DataCard>
      <DataCard title={copy.store.title}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <Label htmlFor="reviews-stars">{copy.store.stars}</Label>
              <span className="text-caption text-muted-foreground">{copy.store.starsHelp}</span>
            </div>
            <Switch
              id="reviews-stars"
              checked={value.storefront.starsOnCards}
              onCheckedChange={(v) => store({ starsOnCards: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="reviews-photos">{copy.store.photos}</Label>
            <Switch
              id="reviews-photos"
              checked={value.storefront.showPhotos}
              onCheckedChange={(v) => store({ showPhotos: v })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reviews-sort">{copy.store.sort}</Label>
            <Select
              items={sorts}
              value={value.storefront.sort}
              onValueChange={(v) => store({ sort: v as ReviewSort })}
            >
              <SelectTrigger id="reviews-sort" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_SORTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {copy.store.sorts[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DataCard>
      <Dialog open={previewing} onOpenChange={setPreviewing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{e.previewTitle}</DialogTitle>
            <DialogDescription>
              {e.previewSubject}: {requestSubject(value.requestEmail.subject, e.sampleProduct)}
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md border border-border bg-muted/40 p-4 text-body whitespace-pre-line">
            {e.previewBody(storeName)}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
