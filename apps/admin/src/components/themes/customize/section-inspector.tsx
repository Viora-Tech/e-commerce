'use client'

import { Puck } from '@measured/puck'
import { customizeContent } from '@/data/customize'
import { useCustomizePuck } from '@/lib/customize-puck'
import SectionIcon from './section-icon'

const copy = customizeContent.inspector

/** The right pane: the selected section's settings, drawn by Puck's own field renderer. */
export default function SectionInspector() {
  // Hooks
  const selected = useCustomizePuck((s) => s.selectedItem)
  const components = useCustomizePuck((s) => s.config.components)

  // Early returns
  if (!selected) {
    return <p className="p-4 text-body text-muted-foreground">{copy.empty}</p>
  }

  // Render logic
  const component = components[selected.type]
  const hasFields = Object.keys(component?.fields ?? {}).length > 0

  return (
    <section className="flex min-h-0 flex-col" aria-label={copy.label}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <SectionIcon type={selected.type} className="size-4 text-muted-foreground" />
        <h2 className="truncate text-body font-semibold text-foreground">
          {component?.label ?? selected.type}
        </h2>
      </div>
      {hasFields ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Puck.Fields />
        </div>
      ) : (
        <p className="p-4 text-body text-muted-foreground">{copy.emptyFields}</p>
      )}
    </section>
  )
}
