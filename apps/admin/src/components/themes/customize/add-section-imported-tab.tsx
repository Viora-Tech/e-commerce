'use client'

import type { ImportedSection } from '@/lib/imported-sections'
import ImportedSectionCard from './imported-section-card'

type ImportedTabProps = {
  sections: ImportedSection[]
  onAdd: (type: string, name: string) => void
}

/** The imported theme's own sections as tiles, two across, like the library's. */
export default function ImportedTab({ sections, onAdd }: ImportedTabProps) {
  // Render logic
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
      {sections.map((s) => (
        <ImportedSectionCard key={s.type} name={s.name} onAdd={() => onAdd(s.type, s.name)} />
      ))}
    </div>
  )
}
