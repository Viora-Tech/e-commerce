'use client'

import {
  BUTTON_RADII,
  DEFAULT_NOTIFY_BUTTON_TEXT,
} from '@commerce/plugin-back-in-stock/settings-schema'
import { CheckIcon as Check, X } from '@commerce/ui/icons'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import DataCard from '@/components/layout/data-card'
import { backInStockContent } from '@/data/back-in-stock'
import { useCopy } from '@/hooks/use-copy'
import type { CampaignTabProps } from './campaign-types'
import ColourField from './colour-field'
import SelectField from './select-field'

/**
 * Campaign › Button: the Notify me button's words and look. Default follows the theme's Add
 * to cart button; Custom takes a colour, a text colour and corner rounding (Essential's Style).
 */
export default function CampaignButtonTab({ form, patch }: CampaignTabProps) {
  // Hooks
  const { campaign: copy } = useCopy(backInStockContent)

  // Render logic
  return (
    <>
      <DataCard bodyClassName="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="bis-button-text">{copy.buttonText}</FieldLabel>
          <Input
            id="bis-button-text"
            value={form.buttonText}
            maxLength={60}
            placeholder={DEFAULT_NOTIFY_BUTTON_TEXT}
            onChange={(e) => patch({ buttonText: e.target.value })}
          />
          <FieldDescription>{copy.buttonTextHelp}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>{copy.style}</FieldLabel>
          <ToggleGroup
            variant="segmented"
            aria-label={copy.style}
            value={[form.buttonStyle]}
            onValueChange={(v: string[]) => {
              const picked = v[0]
              if (picked === 'theme' || picked === 'custom') patch({ buttonStyle: picked })
            }}
            className="w-full"
          >
            <ToggleGroupItem value="theme" className="flex-1">
              {copy.styleTheme}
            </ToggleGroupItem>
            <ToggleGroupItem value="custom" className="flex-1">
              {copy.styleCustom}
            </ToggleGroupItem>
          </ToggleGroup>
          {form.buttonStyle === 'theme' ? (
            <FieldDescription>{copy.styleThemeHelp}</FieldDescription>
          ) : null}
        </Field>
        {form.buttonStyle === 'custom' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColourField
                id="bis-button-bg"
                label={copy.background}
                value={form.buttonBackground}
                onChange={(v) => patch({ buttonBackground: v })}
              />
              <ColourField
                id="bis-button-fg"
                label={copy.textColor}
                value={form.buttonTextColor}
                onChange={(v) => patch({ buttonTextColor: v })}
              />
            </div>
            <SelectField
              id="bis-button-radius"
              label={copy.radius}
              value={form.buttonRadius}
              options={BUTTON_RADII.map((r) => ({ value: r, label: copy.radii[r] }))}
              onChange={(v) =>
                patch({ buttonRadius: v as CampaignTabProps['form']['buttonRadius'] })
              }
            />
          </>
        ) : null}
      </DataCard>
      <DataCard title={copy.pagesCard} bodyClassName="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-body">
          <Check className="size-4 shrink-0 text-success" />
          {copy.pagesProduct}
        </p>
        <div className="flex items-start gap-2 text-body">
          <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="flex flex-col">
            {copy.pagesOther}
            <span className="text-caption text-muted-foreground">{copy.pagesOtherHelp}</span>
          </span>
        </div>
      </DataCard>
    </>
  )
}
