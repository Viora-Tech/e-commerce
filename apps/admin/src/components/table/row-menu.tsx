'use client'

import ActionMenu, { type ActionItem } from '@/components/layout/action-menu'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'

type RowMenuProps = { items: readonly ActionItem[] }

/** The ⋯ menu at the end of a table row: ActionMenu with the table's "More" label. */
export default function RowMenu({ items }: RowMenuProps) {
  // Hooks
  const copy = useCopy(tableContent)

  // Render logic
  return <ActionMenu label={copy.more} items={items} />
}
