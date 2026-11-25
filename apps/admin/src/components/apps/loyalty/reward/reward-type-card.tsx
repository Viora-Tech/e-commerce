'use client'

import { LOYALTY_REWARD_TYPES, type LoyaltyRewardType } from '@commerce/core/loyalty'
import { ChevronsUpDown } from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import type { Dispatch, SetStateAction } from 'react'
import DataCard from '@/components/layout/data-card'
import { loyaltyRewardContent } from '@/data/loyalty-reward'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { amountText, fillTitle, type RewardForm, switchType } from '@/lib/loyalty-reward-form'
import RewardIcon from './reward-icon'

type RewardTypeCardProps = {
  form: RewardForm
  onChange: Dispatch<SetStateAction<RewardForm | null>>
}

/**
 * The reward's first card: the type picker row (glyph, type and an example, ⇅ to change), then
 * the customer title with its `{amount}` and what customers see, and the optional description.
 */
export default function RewardTypeCard({ form, onChange }: RewardTypeCardProps) {
  // Hooks
  const copy = useCopy(loyaltyRewardContent)
  const fmt = useFormat()

  // Helpers
  const set = (patch: Partial<RewardForm>) => onChange((f) => (f ? { ...f, ...patch } : f))

  // Event handlers
  const handleType = (type: LoyaltyRewardType) =>
    onChange((f) => (f ? switchType(f, type, copy.defaultTitles) : f))

  // Render logic
  const preview = fillTitle(form.title, amountText(form, fmt.money))

  return (
    <DataCard>
      <div className="flex flex-col gap-5">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={copy.typeHeading}
            className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-left transition-colors hover:bg-muted"
          >
            <RewardIcon type={form.type} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body font-medium text-ink-strong">{copy.types[form.type]}</span>
              <span className="text-caption text-muted-foreground">{copy.typeHelp[form.type]}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-80">
            {LOYALTY_REWARD_TYPES.map((t) => (
              <DropdownMenuItem key={t} onClick={() => handleType(t)} className="gap-3 py-2">
                <RewardIcon type={t} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-body font-medium text-ink-strong">{copy.types[t]}</span>
                  <span className="text-caption text-muted-foreground">{copy.typeHelp[t]}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Field>
          <FieldLabel htmlFor="reward-title">{copy.title}</FieldLabel>
          <Input
            id="reward-title"
            size="lg"
            maxLength={120}
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
          />
          <FieldDescription>
            {preview ? `${copy.titlePreview(preview)} ${copy.titleHelp}` : copy.titleHelp}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="reward-description">{copy.description}</FieldLabel>
          <Textarea
            id="reward-description"
            rows={2}
            maxLength={500}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
          />
          <FieldDescription>{copy.descriptionHelp}</FieldDescription>
        </Field>
      </div>
    </DataCard>
  )
}
