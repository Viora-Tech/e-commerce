'use client'

import type { ReactNode } from 'react'
import PickedField from '@/components/pickers/picked-field'
import type { PickItem } from '@/components/pickers/resource-pick-types'
import { discountFormContent } from '@/data/discounts'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { type ItemKind, itemTabs, loadPicked } from './pick-sources'

type AppliesToPickerProps = {
  kind: ItemKind
  ids: string[]
  onChange: (next: { kind: ItemKind; ids: string[] }) => void
  /** Extra control on each picked row, before the remove button (e.g. an amount input). */
  rowExtra?: ((item: PickItem) => ReactNode) | undefined
}

/** The products or collections a discount covers (or a buy X get Y side), through Browse. */
export default function AppliesToPicker({ kind, ids, onChange, rowExtra }: AppliesToPickerProps) {
  // Hooks
  const { value: copy } = useCopy(discountFormContent)
  const locale = useLocale()

  return (
    <PickedField
      kind={kind}
      ids={ids}
      tabs={itemTabs(copy, locale)}
      title={copy.pickerTitle}
      search={kind === 'collections' ? copy.collectionSearch : copy.productSearch}
      labels={copy}
      loadPicked={(k, missing) => loadPicked(k as ItemKind, missing, copy, locale)}
      onChange={(next) => onChange({ kind: next.kind as ItemKind, ids: next.ids })}
      rowExtra={rowExtra}
    />
  )
}
