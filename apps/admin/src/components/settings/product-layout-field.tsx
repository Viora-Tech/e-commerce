'use client'

import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useState } from 'react'
import { appearanceContent } from '@/data/appearance'
import { useCopy } from '@/hooks/use-copy'
import {
  type ProductLayout,
  parseProductLayout,
  writeProductLayoutCookie,
} from '@/lib/product-layout'

type ProductLayoutFieldProps = {
  /** What the cookie held when the page rendered on the server. */
  initial: ProductLayout
}

/** "Layout: One page · Settings · Tabs": how the product edit page shows its sections. Saved in this browser. */
export default function ProductLayoutField({ initial }: ProductLayoutFieldProps) {
  // Hooks
  const { productLayout: copy } = useCopy(appearanceContent)
  const [layout, setLayout] = useState(initial)

  // Event handlers
  const handleChange = (values: string[]) => {
    if (!values[0]) return
    const next = parseProductLayout(values[0])
    setLayout(next)
    writeProductLayoutCookie(next)
  }

  // Render logic
  return (
    <ToggleGroup
      aria-label={copy.label}
      value={[layout]}
      onValueChange={handleChange}
      variant="outline"
      spacing={0}
    >
      <ToggleGroupItem value="page" className="px-3">
        {copy.page}
      </ToggleGroupItem>
      <ToggleGroupItem value="settings" className="px-3">
        {copy.settings}
      </ToggleGroupItem>
      <ToggleGroupItem value="tabs" className="px-3">
        {copy.tabs}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
