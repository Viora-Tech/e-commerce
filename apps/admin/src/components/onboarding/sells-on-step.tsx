'use client'

import { SELLS_ON, type SellsOn } from '@commerce/core/onboarding'
import {
  type IconComponent,
  InstagramLogo,
  Loader2Icon,
  Marketplace,
  NewShop,
  Store,
  Website,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { FieldError } from '@commerce/ui/shadcn/field'
import ChoiceCard from '@/components/layout/choice-card'
import { onboardingContent } from '@/data/onboarding'
import { useCopy } from '@/hooks/use-copy'

type SellsOnStepProps = {
  value: SellsOn | null
  onChange: (value: SellsOn) => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
}

const ICONS: Record<SellsOn, IconComponent> = {
  shopify: Store,
  website: Website,
  social: InstagramLogo,
  marketplace: Marketplace,
  none: NewShop,
}

/** Last screen: where they sell today. Shopify sellers land on the importer after setup. */
export default function SellsOnStep({
  value,
  onChange,
  onSubmit,
  submitting,
  error,
}: SellsOnStepProps) {
  // Hooks
  const copy = useCopy(onboardingContent)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title text-ink-strong">{copy.sellsOn.heading}</h1>
        <p className="text-body text-muted-foreground">{copy.sellsOn.body}</p>
      </div>
      <div className="flex flex-col gap-2">
        {SELLS_ON.map((id) => (
          <ChoiceCard
            key={id}
            icon={ICONS[id]}
            label={copy.sellsOn.options[id]}
            selected={value === id}
            onSelect={() => onChange(id)}
            layout="row"
            disabled={submitting}
          />
        ))}
      </div>
      {value === 'shopify' ? (
        <p className="text-body text-muted-foreground">{copy.sellsOn.shopifyNote}</p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={!value || submitting}
        onClick={onSubmit}
      >
        {submitting ? <Loader2Icon className="size-4 animate-spin" /> : null}
        {submitting ? copy.creating : copy.submit}
      </Button>
    </div>
  )
}
