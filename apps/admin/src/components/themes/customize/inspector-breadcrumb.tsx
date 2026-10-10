'use client'

import { ChevronRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Fragment } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import { type CustomizeDoc, FOOTER_ZONE, HEADER_ZONE } from '@/lib/customize-doc'
import { sectionName } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import { findBlock, locateBlock, slotOwner } from '@/lib/customize-slots'

type InspectorBreadcrumbProps = {
  blockId: string
}

type Crumb = { id: string | null; name: string; zone: string | null; index: number | null }

/**
 * Where the selected block sits, as "Template › Group › Image banner" (Figma inspector
 * breadcrumb, 369:129618): the page group, then each container it is inside, then the block
 * itself. Containers are buttons that select them; the group and the block are plain text.
 */
export default function InspectorBreadcrumb({ blockId }: InspectorBreadcrumbProps) {
  // Hooks
  const copy = useCopy(customizeContent.breadcrumb)
  const groups = useCopy(customizeContent.groups)
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const components = useCustomizePuck((s) => s.config.components)
  const dispatch = useCustomizePuck((s) => s.dispatch)

  // Helpers
  const nameOf = (id: string) => {
    const block = findBlock(data, id)
    return block ? sectionName(block, components[block.type]?.label ?? block.type) : id
  }

  // Render logic
  const chain: Crumb[] = []
  let at = locateBlock(data, blockId)
  let id: string | null = blockId
  while (at && id) {
    chain.unshift({ id, name: nameOf(id), zone: at.zone, index: at.index })
    const owner = slotOwner(data, at.zone)
    if (!owner) {
      const group =
        at.zone === HEADER_ZONE
          ? groups.header
          : at.zone === FOOTER_ZONE
            ? groups.footer
            : groups.template
      chain.unshift({ id: null, name: group, zone: null, index: null })
      break
    }
    id = owner.id
    at = { zone: owner.zone, index: owner.index }
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="sr-only">{copy.label}: </span>
      {chain.map((crumb, i) => {
        const last = i === chain.length - 1
        const zone = crumb.zone
        const index = crumb.index
        return (
          <Fragment key={crumb.id ?? 'group'}>
            {i > 0 ? (
              <ChevronRight aria-hidden className="size-3 shrink-0 text-muted-foreground" />
            ) : null}
            {crumb.id && !last && zone !== null && index !== null ? (
              <button
                type="button"
                onClick={() => dispatch({ type: 'setUi', ui: { itemSelector: { index, zone } } })}
                title={copy.select(crumb.name)}
                className={cn(
                  'truncate rounded-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline',
                  CHROME_FOCUS,
                )}
              >
                {crumb.name}
              </button>
            ) : (
              <span
                aria-current={last ? 'location' : undefined}
                className={cn('truncate', last ? 'text-foreground' : 'text-muted-foreground')}
              >
                {crumb.name}
              </span>
            )}
          </Fragment>
        )
      })}
    </span>
  )
}
