'use client'

import { Children, isValidElement, type ReactElement, type ReactNode, useContext } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { isElementStyleField, isSectionSettingsField } from '@/lib/customize-field-shape'
import { InspectorTabContext } from '@/lib/customize-inspector-tab'
import { useCustomizePuck } from '@/lib/customize-puck'
import InspectorCard from './inspector-card'

type InspectorFieldsProps = {
  children: ReactNode
}

/** Puck keys each field element by its field name; `toArray` prefixes that key with `.$`. */
const fieldName = (key: string | null): string => (key ?? '').replace(/^\.\$/, '')

const isKeyed = (item: ReactNode): item is ReactElement => isValidElement(item)

/**
 * Puck's `fields` override: the wrapper around the selected component's fields. The shared
 * Layout / Spacing / Style / Advanced groups (one object field per component) are the
 * Advanced tab, each group its own card; every other field is Basic, in one "Content" card
 * (Figma 381:6222). Fields are matched by name from the component config, not by page
 * structure; when no field matches, everything is shown in the Content card.
 */
export default function InspectorFields({ children }: InspectorFieldsProps) {
  // Hooks
  const copy = useCopy(customizeContent.inspector)
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
  if (tab === 'all' || !known) return <InspectorCard title={copy.content}>{children}</InspectorCard>

  const shown = items.filter((item) => {
    const isAdvanced = isKeyed(item) && advanced.has(fieldName(item.key))
    return tab === 'advanced' ? isAdvanced : !isAdvanced
  })
  if (tab === 'advanced') return <>{shown}</>
  return shown.length > 0 ? <InspectorCard title={copy.content}>{shown}</InspectorCard> : null
}
