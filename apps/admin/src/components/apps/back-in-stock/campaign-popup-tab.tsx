'use client'

import { POPUP_DEFAULTS } from '@commerce/plugin-back-in-stock/settings-schema'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import SwitchRow from '@/components/fields/switch-row'
import DataCard from '@/components/layout/data-card'
import { backInStockContent } from '@/data/back-in-stock'
import { useCopy } from '@/hooks/use-copy'
import type { CampaignForm, CampaignTabProps } from './campaign-types'

type TextKey = keyof typeof POPUP_DEFAULTS

/**
 * Campaign › Pop up: pop-up or inline, then the words Essential lets a merchant change (header,
 * description with {product}, disclaimer, field placeholder and error, button, newsletter box,
 * success message). Styling follows the theme, so there are no colour fields here.
 */
export default function CampaignPopupTab({ form, patch }: CampaignTabProps) {
  // Hooks
  const { campaign: copy } = useCopy(backInStockContent)

  // Helpers
  const text = (key: TextKey, label: string, opts: { long?: boolean; help?: string } = {}) => {
    const id = `bis-${key}`
    const value = form[key] as string
    return (
      <Field>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {opts.long ? (
          <Textarea
            id={id}
            rows={3}
            value={value}
            maxLength={300}
            placeholder={POPUP_DEFAULTS[key]}
            onChange={(e) => patch({ [key]: e.target.value } as Partial<CampaignForm>)}
          />
        ) : (
          <Input
            id={id}
            value={value}
            maxLength={120}
            placeholder={POPUP_DEFAULTS[key]}
            onChange={(e) => patch({ [key]: e.target.value } as Partial<CampaignForm>)}
          />
        )}
        {opts.help ? <FieldDescription>{opts.help}</FieldDescription> : null}
      </Field>
    )
  }

  // Render logic
  return (
    <>
      <DataCard title={copy.display} bodyClassName="flex flex-col gap-3">
        <RadioGroup
          value={form.display}
          onValueChange={(v) => patch({ display: v as CampaignForm['display'] })}
        >
          <label htmlFor="bis-display-popup" className="flex flex-col gap-0.5 text-body">
            <span className="flex items-center gap-2">
              <RadioGroupItem id="bis-display-popup" value="popup" />
              {copy.displayPopup}
            </span>
            <span className="pl-6 text-caption text-muted-foreground">{copy.displayPopupHelp}</span>
          </label>
          <label htmlFor="bis-display-inline" className="flex flex-col gap-0.5 text-body">
            <span className="flex items-center gap-2">
              <RadioGroupItem id="bis-display-inline" value="inline" />
              {copy.displayInline}
            </span>
            <span className="pl-6 text-caption text-muted-foreground">
              {copy.displayInlineHelp}
            </span>
          </label>
        </RadioGroup>
      </DataCard>
      <DataCard title={copy.textCard} bodyClassName="flex flex-col gap-4">
        {text('popupHeading', copy.heading)}
        {text('popupDescription', copy.description, { long: true, help: copy.descriptionHelp })}
        {text('disclaimer', copy.disclaimer, { long: true })}
      </DataCard>
      <DataCard title={copy.formCard} bodyClassName="flex flex-col gap-4">
        {text('emailPlaceholder', copy.emailPlaceholder)}
        {text('emailError', copy.emailError, { help: copy.emailErrorHelp })}
        {text('submitText', copy.submitText)}
        <SwitchRow
          id="bis-newsletter"
          label={copy.newsletter}
          description={copy.newsletterHelp}
          checked={form.newsletter === 'ask'}
          onChange={(v) => patch({ newsletter: v ? 'ask' : 'off' })}
        />
        {form.newsletter === 'ask' ? (
          <div className="flex flex-col gap-4 border-hairline border-l-2 pl-4">
            {text('newsletterText', copy.newsletterText, { long: true })}
            <label htmlFor="bis-news-pre" className="flex items-start gap-2 text-body">
              <Checkbox
                id="bis-news-pre"
                checked={form.newsletterPrechecked}
                onCheckedChange={(on) => patch({ newsletterPrechecked: on === true })}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                {copy.newsletterPrechecked}
                <span className="text-caption text-muted-foreground">
                  {copy.newsletterPrecheckedHelp}
                </span>
              </span>
            </label>
          </div>
        ) : null}
      </DataCard>
      <DataCard title={copy.successCard} bodyClassName="flex flex-col gap-4">
        {text('successHeading', copy.successHeading)}
        {text('successMessage', copy.successMessage, { long: true })}
      </DataCard>
    </>
  )
}
