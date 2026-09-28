'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { Switch } from '@commerce/ui/shadcn/switch'
import MoneyInput from '@/components/fields/money-input'
import KitField from '@/components/kit/kit-field'
import { productFormContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import type { ProductFormState } from './form-state'

type PreorderPaymentMode = ProductFormState['preorderPaymentMode']

type ProductPreorderSectionProps = {
  form: ProductFormState
  depositError?: string | undefined
  onPatch: (patch: Partial<ProductFormState>) => void
}

/** Frame: pre-order toggle, ship date, limit and button label, then payment mode, then the launch countdown. */
export default function ProductPreorderSection({
  form,
  depositError,
  onPatch,
}: ProductPreorderSectionProps) {
  // Hooks
  const { preorder: copy } = useCopy(productFormContent)

  // Event handlers
  const handleMode = (value: string) =>
    onPatch({ preorderPaymentMode: value as PreorderPaymentMode })

  // Render logic
  return (
    <div className="flex flex-col gap-4">
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

      {form.preorderEnabled ? (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:gap-4">
            <KitField label={copy.shipDate} htmlFor="preorder-ship-date">
              <Input
                size="kit"
                type="date"
                id="preorder-ship-date"
                value={form.preorderShipDate}
                onChange={(e) => onPatch({ preorderShipDate: e.target.value })}
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

          <div className="flex flex-col gap-4 md:flex-row md:gap-4">
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
            <KitField label={copy.buttonLabel} htmlFor="preorder-button-label">
              <Input
                size="kit"
                id="preorder-button-label"
                value={form.preorderButtonLabel}
                onChange={(e) => onPatch({ preorderButtonLabel: e.target.value })}
              />
            </KitField>
          </div>

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
        </>
      ) : null}

      <div className="flex flex-col gap-1.5 border-border border-t pt-4">
        <span className="text-body text-foreground">{copy.launchHeading}</span>
        <KitField label={copy.launchAt} htmlFor="launch-at" help={copy.launchAtHelp}>
          <Input
            size="kit"
            type="datetime-local"
            id="launch-at"
            value={form.launchAt}
            onChange={(e) => onPatch({ launchAt: e.target.value })}
          />
        </KitField>
      </div>
    </div>
  )
}
