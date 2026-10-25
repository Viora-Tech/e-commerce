'use client'

import {
  API_AREAS,
  type ApiAccess,
  type ApiArea,
  type ApiScopes,
  READ_ONLY_AREAS,
} from '@commerce/core/api-access'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { mcpContent } from '@/data/mcp'
import { useCopy } from '@/hooks/use-copy'

type ScopePickerProps = {
  value: ApiScopes
  onChange: (next: ApiScopes) => void
  /** Prefix for the checkbox ids, so two pickers on a page do not collide. */
  idPrefix: string
}

/**
 * Figma "Can access": one row per area with Read and Write. Write turns Read on; turning Read
 * off clears the area. Analytics has nothing to write.
 */
export default function ScopePicker({ value, onChange, idPrefix }: ScopePickerProps) {
  // Hooks
  const copy = useCopy(mcpContent)

  // Event handlers
  const handleToggle = (area: ApiArea, access: ApiAccess, on: boolean) => {
    const next = { ...value }
    if (access === 'write') next[area] = on ? 'write' : 'read'
    else if (on) next[area] = next[area] ?? 'read'
    else delete next[area]
    onChange(next)
  }

  // Render logic
  return (
    <div className="flex flex-col divide-y divide-border">
      {API_AREAS.map((area) => {
        const readOnly = READ_ONLY_AREAS.includes(area)
        return (
          <div key={area} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 py-1.5">
            <span className="text-body text-muted-foreground">{copy.areas[area]}</span>
            {(['read', 'write'] as const).map((access) => {
              const id = `${idPrefix}-${area}-${access}`
              const checked = access === 'read' ? Boolean(value[area]) : value[area] === 'write'
              return (
                <label key={access} htmlFor={id} className="flex items-center gap-2 text-body">
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={access === 'write' && readOnly}
                    onCheckedChange={(on) => handleToggle(area, access, on === true)}
                  />
                  {copy.access[access]}
                </label>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
