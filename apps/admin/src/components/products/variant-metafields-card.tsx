'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useState } from 'react'
import MetafieldsCard from '@/components/metaobjects/metafields-card'
import { metafieldsCardContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'

type VariantMetafieldsCardProps = {
  /** Saved variants only: a variant needs an id before its extra fields can be filled in. */
  variants: { id: string; label: string }[]
}

/**
 * Variant extra fields on the product page: pick a variant, fill in its fields. Hidden until
 * the store has made at least one variant extra field (Settings → Custom data → Variants).
 */
export default function VariantMetafieldsCard({ variants }: VariantMetafieldsCardProps) {
  // Hooks
  const copy = useCopy(metafieldsCardContent)
  const [picked, setPicked] = useState<string | null>(null)

  // Render logic
  const current = variants.find((v) => v.id === picked)?.id ?? variants[0]?.id ?? null
  const items = Object.fromEntries(variants.map((v) => [v.id, v.label]))

  return (
    <MetafieldsCard ownerType="variant" ownerId={current} title={copy.variantHeading} hideWhenEmpty>
      {variants.length > 1 && current ? (
        <Select items={items} value={current} onValueChange={(next) => setPicked(String(next))}>
          <SelectTrigger aria-label={copy.variant} className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {variants.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </MetafieldsCard>
  )
}
