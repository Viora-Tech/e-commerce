'use client'

import type { PreorderCampaignVariant } from '@commerce/core'
import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { preordersContent } from '@/data/preorders'
import { useCopy } from '@/hooks/use-copy'

type CampaignVariantLimitsProps = {
  /** The product's variants that take pre-orders in this campaign. */
  variants: PreorderCampaignVariant[]
  /** Limits typed since the last save, by variant id. */
  edits: Record<string, string>
  /** What a blank box uses, already in words. */
  placeholder: string
  disabled: boolean
  onChange: (variantId: string, limit: string) => void
}

/** One product's variants, folded away, each with a box for its own pre-order limit. */
export default function CampaignVariantLimits({
  variants,
  edits,
  placeholder,
  disabled,
  onChange,
}: CampaignVariantLimitsProps) {
  // Hooks
  const { form: f } = useCopy(preordersContent)
  const [open, setOpen] = useState(false)

  // Helpers
  const typedValue = (v: PreorderCampaignVariant) =>
    edits[v.id] ?? (v.limit == null ? '' : String(v.limit))

  // Early returns
  if (variants.length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-fit items-center gap-1 text-caption font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {f.variantLimits(variants.length)}
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 transition-transform group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 flex flex-col gap-1 border-border border-l pl-3">
          {variants.map((v) => (
            <li key={v.id} className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body">{v.title}</span>
                {v.sku ? (
                  <span className="truncate text-caption text-muted-foreground">{v.sku}</span>
                ) : null}
              </span>
              <span className="w-28 shrink-0">
                <Input
                  aria-label={f.variantLimit(v.sku ? `${v.title} (${v.sku})` : v.title)}
                  inputMode="numeric"
                  placeholder={placeholder}
                  value={typedValue(v)}
                  disabled={disabled}
                  onChange={(e) => onChange(v.id, e.target.value)}
                />
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
