'use client'

import { SELLS_WHAT, type SellsWhat, starterCollections } from '@commerce/core/onboarding'
import {
  Beauty,
  Clothing,
  Electronics,
  FoodDrink,
  Handmade,
  HomeDecor,
  type IconComponent,
  Jewellery,
  SomethingElse,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { onboardingContent as copy } from '@/data/onboarding'
import ChoiceCard from './choice-card'

type SellsWhatStepProps = {
  value: SellsWhat | null
  onChange: (value: SellsWhat) => void
  onNext: () => void
}

const ICONS: Record<SellsWhat, IconComponent> = {
  fashion: Clothing,
  beauty: Beauty,
  jewellery: Jewellery,
  home: HomeDecor,
  electronics: Electronics,
  food: FoodDrink,
  handmade: Handmade,
  other: SomethingElse,
}

/** Screen 2: picture cards for what the store sells; the answer picks its starter collections. */
export default function SellsWhatStep({ value, onChange, onNext }: SellsWhatStepProps) {
  // Render logic
  const starters = value ? starterCollections(value).map((c) => c.title) : []

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title text-ink-strong">{copy.sellsWhat.heading}</h1>
        <p className="text-body text-muted-foreground">{copy.sellsWhat.body}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {SELLS_WHAT.map((id) => (
          <ChoiceCard
            key={id}
            icon={ICONS[id]}
            label={copy.sellsWhat.options[id]}
            selected={value === id}
            onSelect={() => onChange(id)}
            layout="tile"
          />
        ))}
      </div>
      {starters.length > 0 ? (
        <p className="text-body text-muted-foreground">
          {copy.sellsWhat.starterNote} {starters.join(', ')}
        </p>
      ) : null}
      <Button type="button" size="lg" className="w-full" disabled={!value} onClick={onNext}>
        {copy.next}
      </Button>
    </div>
  )
}
