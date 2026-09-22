'use client'

import type { CollectionKind, CollectionRules } from '@commerce/core/collections'
import { cn } from '@commerce/ui/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { collectionFormContent as copy } from '@/data/collections'
import CollectionProductsPicker, { type PickedProduct } from './collection-products-picker'
import CollectionRulesBuilder from './collection-rules-builder'

type CollectionMembersCardProps = {
  kind: CollectionKind
  rules: CollectionRules
  products: PickedProduct[]
  matches: number | null
  onKind: (kind: CollectionKind) => void
  onRules: (rules: CollectionRules) => void
  onProducts: (products: PickedProduct[]) => void
}

const OPTION =
  'flex flex-1 flex-col gap-1 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Manual or automatic membership; the choice swaps the editor below it. */
export default function CollectionMembersCard({
  kind,
  rules,
  products,
  matches,
  onKind,
  onRules,
  onProducts,
}: CollectionMembersCardProps) {
  // Render logic
  const options = [
    { value: 'manual' as const, label: copy.kind.manual, help: copy.kind.manualHelp },
    { value: 'automatic' as const, label: copy.kind.automatic, help: copy.kind.automaticHelp },
  ]

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.kind.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onKind(o.value)}
              aria-pressed={kind === o.value}
              className={cn(
                OPTION,
                kind === o.value
                  ? 'border-primary bg-primary-soft'
                  : 'border-line bg-card hover:bg-background',
              )}
            >
              <span className="text-body font-medium text-foreground">{o.label}</span>
              <span className="text-caption text-muted-foreground">{o.help}</span>
            </button>
          ))}
        </div>
        {kind === 'automatic' ? (
          <CollectionRulesBuilder rules={rules} matches={matches} onChange={onRules} />
        ) : (
          <CollectionProductsPicker products={products} onChange={onProducts} />
        )}
      </CardContent>
    </Card>
  )
}
