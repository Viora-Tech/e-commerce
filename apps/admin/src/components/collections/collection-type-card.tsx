'use client'

import type { CollectionKind } from '@commerce/core/collections'
import { Lock } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import DataCard from '@/components/layout/data-card'
import { collectionDetailContent } from '@/data/collections'
import { useCopy } from '@/hooks/use-copy'

type CollectionTypeCardProps = {
  kind: CollectionKind
  /** An existing collection keeps its type. */
  locked: boolean
  onChange: (kind: CollectionKind) => void
}

const OPTION = 'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors'

/** "Collection type" card: manual or automatic, as two radio cards. */
export default function CollectionTypeCard({ kind, locked, onChange }: CollectionTypeCardProps) {
  // Hooks
  const { type: copy } = useCopy(collectionDetailContent)

  // Render logic
  const options = [
    { value: 'manual' as const, label: copy.manual, help: copy.manualHelp },
    { value: 'automatic' as const, label: copy.automatic, help: copy.automaticHelp },
  ]

  return (
    <DataCard
      title={copy.heading}
      action={locked ? <Lock className="size-4 text-muted-foreground" aria-hidden /> : null}
      bodyClassName="flex flex-col gap-3"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{copy.heading}</legend>
        {options.map((o) => {
          const checked = kind === o.value
          return (
            <label
              key={o.value}
              className={cn(
                OPTION,
                'has-focus-visible:ring-2 has-focus-visible:ring-ring',
                checked
                  ? 'border-primary bg-primary-soft'
                  : 'border-transparent bg-muted/60 hover:bg-muted',
                locked
                  ? checked
                    ? 'cursor-default'
                    : 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer',
              )}
            >
              <input
                type="radio"
                name="collection-kind"
                className="sr-only"
                checked={checked}
                disabled={locked}
                onChange={() => onChange(o.value)}
              />
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                  checked ? 'border-primary bg-primary' : 'border-input bg-card',
                )}
              >
                {checked ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
              </span>
              <span className="flex flex-col">
                <span className="text-body font-medium text-foreground">{o.label}</span>
                <span className="text-caption text-muted-foreground">{o.help}</span>
              </span>
            </label>
          )
        })}
      </fieldset>
      <p className="text-caption text-muted-foreground">{locked ? copy.locked : copy.choose}</p>
    </DataCard>
  )
}
