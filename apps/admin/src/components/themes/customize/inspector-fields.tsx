'use client'

import { type ReactNode, useContext, useEffect } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { type FieldFocusRequest, onFieldFocus } from '@/lib/customize-canvas-events'
import { isElementStyleField, isSectionSettingsField } from '@/lib/customize-field-shape'
import { InspectorTabContext } from '@/lib/customize-inspector-tab'
import { useCustomizePuck } from '@/lib/customize-puck'
import InspectorCard from './inspector-card'

type InspectorFieldsProps = {
  /** Puck's rendered fields, keyed by field name (the `fields` override's `fields` prop, 0.24+). */
  fields: Partial<Record<string, ReactNode>>
}

type NamedField = [name: string, node: ReactNode]

/** Each field in a box-less wrapper the canvas can find it by (`data-inspector-field`). */
const marked = (items: NamedField[]) =>
  items.map(([name, node]) => (
    <div key={name} className="contents" data-inspector-field={name}>
      {node}
    </div>
  ))

/**
 * A canvas click's field, shown: scrolled to the middle with a short ring, then focused, or its
 * image picker opened. Fields on the other tab are not on screen and are left alone.
 */
function showField(request: FieldFocusRequest, reducedMotion: boolean): void {
  const box = document.querySelector(`[data-inspector-field="${CSS.escape(request.field)}"]`)
  const first = box?.firstElementChild as HTMLElement | null | undefined
  if (!first) return
  first.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })
  if (!reducedMotion) {
    first.animate(
      [
        { boxShadow: '0 0 0 2px var(--color-ring, currentColor)', borderRadius: '0.5rem' },
        { boxShadow: '0 0 0 2px transparent', borderRadius: '0.5rem' },
      ],
      { duration: 1200, easing: 'ease-out' },
    )
  }
  if (request.pickImage) {
    first.querySelector<HTMLElement>('[data-image-pick]')?.click()
    return
  }
  if (!request.focus) return
  first
    .querySelector<HTMLElement>('input:not([type="hidden"]), textarea, [contenteditable="true"]')
    ?.focus({ preventScroll: true })
}

/**
 * Puck's `fields` override: the wrapper around the selected component's fields, read from
 * Puck's `fields` map (field name to rendered field) rather than `children`, which since 0.24
 * is one opaque element (Puck's own layout) with nothing to filter by name. The shared
 * Layout / Spacing / Style / Advanced groups (one object field per component) are the
 * Advanced tab, each group its own card; every other field is Basic, in one "Content" card
 * (Figma 381:6222). Fields are matched by name from the component config, not by page
 * structure; when no field matches, everything is shown in the Content card.
 */
export default function InspectorFields({ fields }: InspectorFieldsProps) {
  // Hooks
  const copy = useCopy(customizeContent.inspector)
  const tab = useContext(InspectorTabContext)
  const selected = useCustomizePuck((s) => s.selectedItem)
  const components = useCustomizePuck((s) => s.config.components)
  const selectedId = useCustomizePuck((s) => s.selectedItem?.props.id)
  // A click on the canvas asks for one of this block's fields.
  useEffect(
    () =>
      onFieldFocus((request) => {
        if (request.blockId !== selectedId) return
        showField(request, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      }),
    [selectedId],
  )

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
  const items = Object.entries(fields).filter((entry): entry is NamedField => entry[1] != null)
  const known = items.some(([name]) => advanced.has(name))
  if (tab === 'all' || !known) {
    return <InspectorCard title={copy.content}>{marked(items)}</InspectorCard>
  }

  const shown = items.filter(([name]) => (tab === 'advanced') === advanced.has(name))
  if (tab === 'advanced') return <>{marked(shown)}</>
  return shown.length > 0 ? (
    <InspectorCard title={copy.content}>{marked(shown)}</InspectorCard>
  ) : null
}
