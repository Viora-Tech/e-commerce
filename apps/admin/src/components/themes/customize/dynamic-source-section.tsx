'use client'

import { applyBindings, boundPaths, type SourceValues } from '@commerce/core/dynamic-sources'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { loadValues, useDynamicSourceScope } from '@/lib/dynamic-sources'

type DynamicSourceSectionProps = {
  /** The section's own Puck render. */
  render: (props: Record<string, unknown>) => ReactNode
  props: Record<string, unknown>
}

const NO_VALUES: SourceValues = {}

/**
 * One section in the Customize preview, with its connected settings filled from
 * the previewed product or collection, as the storefront fills them. Until the
 * values arrive (and wherever a source is empty) the typed-in fallback shows.
 */
export default function DynamicSourceSection({ render, props }: DynamicSourceSectionProps) {
  // Hooks
  const scope = useDynamicSourceScope()
  const [values, setValues] = useState<SourceValues>(NO_VALUES)
  const { puck, ...settings } = props
  const paths = boundPaths({ content: [{ type: 'section', props: settings }] })
  const key = paths.join('\n')
  const productId = scope?.productId ?? null
  const collectionId = scope?.collectionId ?? null

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `paths`.
  useEffect(() => {
    if (!key) return
    let active = true
    loadValues(key.split('\n'), {
      template: scope?.template ?? 'home',
      productId,
      collectionId,
    }).then((next) => active && setValues(next))
    return () => {
      active = false
    }
  }, [key, productId, collectionId])

  // Early returns
  if (paths.length === 0) return render(props)

  // Render logic
  return render({ ...applyBindings(settings, values), puck })
}
