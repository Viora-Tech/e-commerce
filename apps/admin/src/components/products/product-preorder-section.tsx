'use client'

import { PREORDER_OWN_FIELDS, type PreorderOwnField } from '@commerce/core/preorder'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DateField from '@/components/fields/date-field'
import MoneyInput from '@/components/fields/money-input'
import KitField from '@/components/kit/kit-field'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import type { ProductFormState } from './form-state'

type PreorderPaymentMode = ProductFormState['preorderPaymentMode']

type CampaignOption = { id: string; name: string; status: 'active' | 'paused' }

type ProductPreorderSectionProps = {
  form: ProductFormState
  depositError?: string | undefined
  onPatch: (patch: Partial<ProductFormState>) => void
}

/**
 * Frame: the pre-order campaign (#142) or the pre-order toggle, then ship date, limit and button
 * label, the note, payment mode, then the launch countdown. In a campaign only the settings the
 * product keeps its own are shown; the rest follow the campaign.
 */
export default function ProductPreorderSection({
  form,
  depositError,
  onPatch,
}: ProductPreorderSectionProps) {
  // Hooks
  const { preorder: copy } = useCopy(productFormContent)
  const [campaigns, setCampaigns] = useState<CampaignOption[] | null>(null)
  useEffect(() => {
    let cancelled = false
    api.preorders.campaigns
      .list()
      .then((rows) => {
        if (!cancelled)
          setCampaigns(rows.map((c) => ({ id: c.id, name: c.name, status: c.status })))
      })
      .catch(() => {
        if (!cancelled) setCampaigns([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Helpers
  // Outside a campaign every field shows while pre-order is on; in one, only the kept ones.
  const shows = (field: PreorderOwnField) =>
    form.preorderCampaignId ? form.preorderOwn.includes(field) : form.preorderEnabled

  // Event handlers
  const handleMode = (value: string) =>
    onPatch({ preorderPaymentMode: value as PreorderPaymentMode })

  const handleCampaign = (value: string) => onPatch({ preorderCampaignId: value || null })

  const handleOwn = (field: PreorderOwnField, on: boolean) =>
    onPatch({
      preorderOwn: on
        ? [...form.preorderOwn.filter((f) => f !== field), field]
        : form.preorderOwn.filter((f) => f !== field),
    })

  // Render logic
  const inCampaign = Boolean(form.preorderCampaignId)
  const anyShown = PREORDER_OWN_FIELDS.some(shows)

  return (
    <div className="flex flex-col gap-4">
      <KitField label={copy.campaign} htmlFor="preorder-campaign" help={copy.campaignHelp}>
        <NativeSelect
          id="preorder-campaign"
          value={form.preorderCampaignId ?? ''}
          disabled={campaigns === null}
          onChange={(e) => handleCampaign(e.target.value)}
        >
          <NativeSelectOption value="">
            {campaigns === null ? copy.campaignLoading : copy.campaignNone}
          </NativeSelectOption>
          {(campaigns ?? []).map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.status === 'paused' ? copy.campaignPaused(c.name) : c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </KitField>
      <Link
        href={
          form.preorderCampaignId
            ? routes.products.preorderCampaign(form.preorderCampaignId)
            : routes.products.preorders()
        }
        className="text-caption text-link hover:underline"
      >
        {copy.manageCampaigns}
      </Link>

      {inCampaign ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-body text-foreground">{copy.ownHeading}</legend>
          <p className="text-caption text-muted-foreground">{copy.ownHelp}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {PREORDER_OWN_FIELDS.map((field) => (
              <label
                key={field}
                htmlFor={`preorder-own-${field}`}
                className="flex items-center gap-2 text-body"
              >
                <Checkbox
                  id={`preorder-own-${field}`}
                  checked={form.preorderOwn.includes(field)}
                  onCheckedChange={(on) => handleOwn(field, on === true)}
                />
                {copy.own[field]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Switch
              id="preorder-enabled"
              checked={form.preorderEnabled}
              onCheckedChange={(value) => onPatch({ preorderEnabled: Boolean(value) })}
            />
            <label htmlFor="preorder-enabled" className="text-body text-foreground">
              {copy.enable}
            </label>
          </div>
          <p className="text-caption text-muted-foreground">{copy.enableHelp}</p>
        </>
      )}

      {shows('shipping') ? (
        <div className="flex flex-col gap-4 md:flex-row md:gap-4">
          <KitField label={copy.shipDate} htmlFor="preorder-ship-date">
            <DateField
              id="preorder-ship-date"
              value={form.preorderShipDate}
              onChange={(v) => onPatch({ preorderShipDate: v })}
            />
          </KitField>
          <KitField
            label={copy.shipsInDays}
            htmlFor="preorder-ships-in-days"
            help={copy.shipsInDaysHelp}
          >
            <Input
              size="kit"
              type="number"
              min={0}
              id="preorder-ships-in-days"
              value={form.preorderShipsInDays}
              onChange={(e) => onPatch({ preorderShipsInDays: e.target.value })}
            />
          </KitField>
        </div>
      ) : null}

      {shows('limit') || shows('button') ? (
        <div className="flex flex-col gap-4 md:flex-row md:gap-4">
          {shows('limit') ? (
            <KitField label={copy.limit} htmlFor="preorder-limit" help={copy.limitHelp}>
              <Input
                size="kit"
                type="number"
                min={1}
                id="preorder-limit"
                value={form.preorderLimit}
                onChange={(e) => onPatch({ preorderLimit: e.target.value })}
              />
            </KitField>
          ) : null}
          {shows('button') ? (
            <KitField label={copy.buttonLabel} htmlFor="preorder-button-label">
              <Input
                size="kit"
                id="preorder-button-label"
                value={form.preorderButtonLabel}
                onChange={(e) => onPatch({ preorderButtonLabel: e.target.value })}
              />
            </KitField>
          ) : null}
        </div>
      ) : null}

      {shows('note') ? (
        <KitField label={copy.note} htmlFor="preorder-note" help={copy.noteHelp}>
          <Textarea
            id="preorder-note"
            rows={3}
            maxLength={500}
            placeholder={copy.notePlaceholder}
            value={form.preorderNote}
            onChange={(e) => onPatch({ preorderNote: e.target.value })}
          />
        </KitField>
      ) : null}

      {shows('payment') ? (
        <KitField label={copy.paymentMode} help={depositError}>
          <RadioGroup
            value={form.preorderPaymentMode}
            onValueChange={handleMode}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="preorder-mode-full" value="full" />
              <label htmlFor="preorder-mode-full" className="text-body text-foreground">
                {copy.paymentModeFull}
              </label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem id="preorder-mode-fixed" value="fixed" />
              <label htmlFor="preorder-mode-fixed" className="text-body text-foreground">
                {copy.paymentModeFixed}
              </label>
              {form.preorderPaymentMode === 'fixed' ? (
                <MoneyInput
                  size="kit"
                  id="preorder-deposit-amount"
                  aria-label={copy.depositAmount}
                  value={form.preorderDeposit}
                  onChange={(preorderDeposit) => onPatch({ preorderDeposit })}
                  className="w-32"
                />
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem id="preorder-mode-percentage" value="percentage" />
              <label htmlFor="preorder-mode-percentage" className="text-body text-foreground">
                {copy.paymentModePercentage}
              </label>
              {form.preorderPaymentMode === 'percentage' ? (
                <Input
                  size="kit"
                  type="number"
                  min={1}
                  max={99}
                  id="preorder-deposit-percent"
                  aria-label={copy.depositPercent}
                  value={form.preorderDepositPercent}
                  onChange={(e) => onPatch({ preorderDepositPercent: e.target.value })}
                  className="w-24"
                />
              ) : null}
            </div>
          </RadioGroup>
        </KitField>
      ) : null}

      {anyShown || inCampaign ? (
        <div className="flex items-center gap-3">
          <Switch
            id="preorder-hide-until-launch"
            checked={form.preorderHideFromCollectionsUntilLaunch}
            onCheckedChange={(value) =>
              onPatch({ preorderHideFromCollectionsUntilLaunch: Boolean(value) })
            }
          />
          <label htmlFor="preorder-hide-until-launch" className="text-body text-foreground">
            {copy.hideUntilLaunch}
          </label>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 border-border border-t pt-4">
        <span className="text-body text-foreground">{copy.launchHeading}</span>
        <KitField label={copy.launchAt} htmlFor="launch-at" help={copy.launchAtHelp}>
          <DateField
            mode="datetime"
            id="launch-at"
            value={form.launchAt}
            onChange={(v) => onPatch({ launchAt: v })}
          />
        </KitField>
      </div>
    </div>
  )
}
