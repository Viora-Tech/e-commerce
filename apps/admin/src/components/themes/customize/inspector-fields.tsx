'use client'

import { Children, isValidElement, type ReactElement, type ReactNode, useContext } from 'react'
import { isElementStyleField, isSectionSettingsField } from '@/lib/customize-field-shape'
import { InspectorTabContext } from '@/lib/customize-inspector-tab'
import { useCustomizePuck } from '@/lib/customize-puck'

type InspectorFieldsProps = {
  children: ReactNode
}

/** Puck keys each field element by its field name; `toArray` prefixes that key with `.$`. */
const fieldName = (key: string | null): string => (key ?? '').replace(/^\.\$/, '')

const isKeyed = (item: ReactNode): item is ReactElement => isValidElement(item)

/**
 * Puck's `fields` override: the wrapper around the selected component's fields. The shared
 * Layout / Spacing / Style / Advanced groups (one object field per component) are the
 * Advanced tab; every other field is Basic. Fields are matched by name from the component
 * config, not by page structure; when no field matches, everything is shown.
 */
export default function InspectorFields({ children }: InspectorFieldsProps) {
  // Hooks
  const tab = useContext(InspectorTabContext)
  const selected = useCustomizePuck((s) => s.selectedItem)
  const components = useCustomizePuck((s) => s.config.components)

  // Render logic
  const config = Object.entries(components[selected?.type ?? '']?.fields ?? {})
  const advanced = new Set(
    config
      .filter(
        ([name, field]) =>
          isSectionSettingsField(field as never, name) || isElementStyleField(field as never, name),
      )
      .map(([name]) => name),
  )
  const items = Children.toArray(children)
  const known = items.some((item) => isKeyed(item) && advanced.has(fieldName(item.key)))
  if (tab === 'all' || !known) return <>{children}</>

  return (
    <>
      {items.filter((item) => {
        const isAdvanced = isKeyed(item) && advanced.has(fieldName(item.key))
        return tab === 'advanced' ? isAdvanced : !isAdvanced
      })}
    </>
  )
}
