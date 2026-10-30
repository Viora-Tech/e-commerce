'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PillTabs from '@/components/layout/pill-tabs'
import { preordersContent } from '@/data/preorders'
import { useCopy } from '@/hooks/use-copy'
import type { CampaignFormState } from './campaign-form-state'
import CampaignPreview from './campaign-preview'

type CampaignLookCardProps = {
  form: CampaignFormState
  disabled: boolean
  onChange: (patch: Partial<CampaignFormState>) => void
}

type Tab = 'content' | 'design'
type ContentKey = keyof CampaignFormState['content']
type DesignKey = keyof CampaignFormState['design']

const NOTES: ContentKey[] = ['productNote', 'cartLineText', 'orderNote']
const COLOURS: DesignKey[] = ['buttonBackground', 'buttonText', 'badgeBackground', 'badgeText']
const HEX6 = /^#[0-9a-f]{6}$/i

/**
 * The campaign's storefront words and colours (#144): Content and Design tabs, with a live
 * preview of the product button, the cart line and the order note beside them.
 */
export default function CampaignLookCard({ form, disabled, onChange }: CampaignLookCardProps) {
  // Hooks
  const { look: copy } = useCopy(preordersContent)
  const [tab, setTab] = useState<Tab>('content')

  // Event handlers
  const handleContent = (key: ContentKey, value: string) =>
    onChange({ content: { ...form.content, [key]: value } })

  const handleDesign = (key: DesignKey, value: string) =>
    onChange({ design: { ...form.design, [key]: value } })

  // Render logic
  const colourLabel: Record<DesignKey, string> = {
    buttonBackground: copy.buttonBackground,
    buttonText: copy.buttonTextColour,
    badgeBackground: copy.badgeBackground,
    badgeText: copy.badgeTextColour,
  }
  const noteLabel: Record<string, string> = {
    productNote: copy.productNote,
    cartLineText: copy.cartLineText,
    orderNote: copy.orderNote,
  }

  return (
    <DataCard
      title={copy.heading}
      action={
        <PillTabs<Tab>
          tabs={[
            { value: 'content', label: copy.tabs.content },
            { value: 'design', label: copy.tabs.design },
          ]}
          value={tab}
          onChange={setTab}
        />
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
        {tab === 'content' ? (
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="campaign-button-text">{copy.buttonText}</FieldLabel>
                <Input
                  id="campaign-button-text"
                  maxLength={60}
                  placeholder={copy.buttonTextPlaceholder}
                  value={form.content.buttonText}
                  disabled={disabled}
                  onChange={(e) => handleContent('buttonText', e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="campaign-badge-text">{copy.badgeText}</FieldLabel>
                <Input
                  id="campaign-badge-text"
                  maxLength={40}
                  placeholder={copy.badgeTextPlaceholder}
                  value={form.content.badgeText}
                  disabled={disabled}
                  onChange={(e) => handleContent('badgeText', e.target.value)}
                />
              </Field>
            </div>
            {NOTES.map((key) => (
              <Field key={key}>
                <FieldLabel htmlFor={`campaign-${key}`}>{noteLabel[key]}</FieldLabel>
                <Textarea
                  id={`campaign-${key}`}
                  rows={2}
                  maxLength={500}
                  value={form.content[key]}
                  disabled={disabled}
                  onChange={(e) => handleContent(key, e.target.value)}
                />
              </Field>
            ))}
            <FieldDescription>{copy.noteHelp}</FieldDescription>
            <Field>
              <FieldLabel htmlFor="campaign-block-message">{copy.blockMessage}</FieldLabel>
              <Textarea
                id="campaign-block-message"
                rows={2}
                maxLength={300}
                placeholder={copy.blockMessagePlaceholder}
                value={form.content.blockMessage}
                disabled={disabled}
                onChange={(e) => handleContent('blockMessage', e.target.value)}
              />
            </Field>
          </FieldGroup>
        ) : (
          <FieldGroup>
            {COLOURS.map((key) => (
              <Field key={key}>
                <FieldLabel htmlFor={`campaign-colour-${key}`}>{colourLabel[key]}</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={colourLabel[key]}
                    value={HEX6.test(form.design[key]) ? form.design[key] : '#000000'}
                    disabled={disabled}
                    onChange={(e) => handleDesign(key, e.target.value)}
                    className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                  />
                  <Input
                    id={`campaign-colour-${key}`}
                    placeholder="#1a1a1a"
                    maxLength={7}
                    value={form.design[key]}
                    disabled={disabled}
                    onChange={(e) => handleDesign(key, e.target.value)}
                    className="w-32"
                  />
                  {form.design[key] ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => handleDesign(key, '')}
                    >
                      {copy.clear}
                    </Button>
                  ) : null}
                </div>
              </Field>
            ))}
            <FieldDescription>{copy.colourHelp}</FieldDescription>
          </FieldGroup>
        )}
        <CampaignPreview form={form} />
      </div>
    </DataCard>
  )
}
