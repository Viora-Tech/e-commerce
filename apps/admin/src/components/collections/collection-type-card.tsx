'use client'

import type { CollectionKind } from '@commerce/core/collections'
import { AiIcon, GripVertical } from '@commerce/ui/icons'
import ChoiceCard from '@/components/layout/choice-card'
import DataCard from '@/components/layout/data-card'
import { collectionDetailContent } from '@/data/collections'
import { useCopy } from '@/hooks/use-copy'

type CollectionTypeCardProps = {
  kind: CollectionKind
  /** An existing collection keeps its type. */
  locked: boolean
  onChange: (kind: CollectionKind) => void
}

/** Figma collection detail, "Collection type" (629:7240): manual or automatic as two option tiles. */
export default function CollectionTypeCard({ kind, locked, onChange }: CollectionTypeCardProps) {
  // Hooks
  const { type: copy } = useCopy(collectionDetailContent)

  // Render logic
  const options = [
    { value: 'manual' as const, icon: GripVertical, label: copy.manual, help: copy.manualHelp },
    { value: 'automatic' as const, icon: AiIcon, label: copy.automatic, help: copy.automaticHelp },
  ]

  return (
    <DataCard title={copy.heading} bodyClassName="flex flex-col gap-3">
      <div role="radiogroup" aria-label={copy.heading} className="flex flex-col gap-2.5">
        {options.map((o) => (
          <ChoiceCard
            key={o.value}
            layout="row"
            icon={o.icon}
            label={o.label}
            description={o.help}
            selected={kind === o.value}
            disabled={locked && kind !== o.value}
            showCheck
            onSelect={() => !locked && onChange(o.value)}
          />
        ))}
      </div>
      <p className="text-caption text-muted-foreground">{locked ? copy.locked : copy.choose}</p>
    </DataCard>
  )
}
