'use client'

import type { ImportResource, LeftBehind } from '@commerce/plugin-shopify-import/client'
import { ChevronDown, InfoIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { useState } from 'react'
import { shopifyImportContent } from '@/data/shopify-import'
import { shopifyImportRunContent } from '@/data/shopify-import-run'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { RESOURCE_ICON } from './run-resource-icons'

type RunLeftGroupProps = {
  resource: ImportResource
  left: LeftBehind[]
  defaultOpen: boolean
}

type Copy = typeof shopifyImportContent.left

/** Rows shown before "Show all". */
const PREVIEW_ROWS = 3

/** One plain sentence for a reason; the owner type reads as words ("customers"). */
function sentence(copy: Copy, l: LeftBehind): string {
  const detail =
    l.reason === 'metafield_owner'
      ? (copy.owners[l.detail ?? ''] ?? (l.detail ?? '').toLowerCase())
      : (l.detail ?? '')
  return copy.reasons[l.reason](l.count, detail)
}

/** One type's reasons behind a collapsible header with the total as a badge; long lists show three. */
export default function RunLeftGroup({ resource, left, defaultOpen }: RunLeftGroupProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.left)
  const view = useCopy(shopifyImportRunContent)
  const resources = useCopy(shopifyImportContent.resources)
  const fmt = useFormat()
  const [all, setAll] = useState(false)

  // Event handlers
  const handleToggle = () => setAll(!all)

  // Render logic
  const Icon = RESOURCE_ICON[resource]
  const total = left.reduce((sum, l) => sum + l.count, 0)
  const rows = all ? left : left.slice(0, PREVIEW_ROWS)
  const hidden = left.length - PREVIEW_ROWS

  return (
    <li className="rounded-xl border border-hairline bg-card">
      <Collapsible defaultOpen={defaultOpen} className="group/left">
        <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
            <Icon />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-ink-strong">
            {resources[resource]}
          </span>
          <span className="rounded-full bg-chip-neutral px-2 py-0.5 text-caption font-medium text-chip-neutral-text tabular-nums">
            {fmt.number(total)}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-data-[open]/left:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none">
          <ul className="flex flex-col divide-y divide-hairline border-t border-hairline">
            {rows.map((l) => (
              <li
                key={`${l.reason}-${l.detail ?? ''}`}
                className="flex items-start gap-2.5 px-4 py-2.5 text-body text-ink-strong"
              >
                <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">{sentence(copy, l)}</span>
              </li>
            ))}
          </ul>
          {hidden > 0 ? (
            <div className="border-t border-hairline px-2 py-1.5">
              <Button type="button" variant="ghost" size="sm" onClick={handleToggle}>
                {all ? view.left.showLess : view.left.showAll(left.length)}
              </Button>
            </div>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}
