'use client'

import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
} from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { type FieldFocusRequest, onFieldFocus } from '@/lib/customize-canvas-events'
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

/** Each field in a box-less wrapper the canvas can find it by (`data-inspector-field`). */
const marked = (items: ReactNode[]) =>
  items.map((item) =>
    isKeyed(item) ? (
      <div key={item.key} className="contents" data-inspector-field={fieldName(item.key)}>
        {item}
      </div>
    ) : (
      item
    ),
  )

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
  const items = Children.toArray(children)
  const known = items.some((item) => isKeyed(item) && advanced.has(fieldName(item.key)))
  if (tab === 'all' || !known) {
    return <InspectorCard title={copy.content}>{marked(items)}</InspectorCard>
  }

  const shown = items.filter((item) => {
    const isAdvanced = isKeyed(item) && advanced.has(fieldName(item.key))
    return tab === 'advanced' ? isAdvanced : !isAdvanced
  })
  if (tab === 'advanced') return <>{marked(shown)}</>
  return shown.length > 0 ? (
    <InspectorCard title={copy.content}>{marked(shown)}</InspectorCard>
  ) : null
}
