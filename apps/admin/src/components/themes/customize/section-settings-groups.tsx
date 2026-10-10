'use client'

import type { Field } from '@puckeditor/core'
import type { FieldLike } from '@/lib/customize-field-shape'
import InspectorCard from './inspector-card'
import SettingsGroupBody from './settings-group-body'

type SectionSettingsGroupsProps = {
  field: FieldLike
  value: Record<string, unknown>
  onChange: (value: unknown) => void
}

type GroupField = { label?: string; objectFields?: Record<string, Field> }

/**
 * The Layout / Spacing / Style / Advanced settings every section shares (and a custom block's
 * Size / Typography / Colour / Corners), on the Advanced tab: one bordered card per group,
 * open, as the Figma inspector's Layout, Spacing and Typography cards (369:9692).
 */
export default function SectionSettingsGroups({
  field,
  value,
  onChange,
}: SectionSettingsGroupsProps) {
  // Event handlers
  const handleChange = (group: string, key: string, next: unknown) => {
    const current = (value[group] ?? {}) as Record<string, unknown>
    onChange({ ...value, [group]: { ...current, [key]: next } })
  }
  const handlePatch = (group: string, patch: Record<string, unknown>) => {
    const current = (value[group] ?? {}) as Record<string, unknown>
    onChange({ ...value, [group]: { ...current, ...patch } })
  }

  // Render logic
  const groups = Object.entries((field.objectFields ?? {}) as Record<string, GroupField>)

  return (
    <>
      {groups.map(([key, group]) => (
        <InspectorCard key={key} title={group.label ?? key}>
          <SettingsGroupBody
            group={key}
            fields={group.objectFields ?? {}}
            value={(value[key] ?? {}) as Record<string, unknown>}
            onChange={(subKey, next) => handleChange(key, subKey, next)}
            onPatch={(patch) => handlePatch(key, patch)}
          />
        </InspectorCard>
      ))}
    </>
  )
}
