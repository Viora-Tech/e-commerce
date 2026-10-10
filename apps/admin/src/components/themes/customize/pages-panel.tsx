'use client'

import type { AlternateKind } from '@commerce/core/theme'
import { useEffect } from 'react'
import { type TemplateChange, useTemplateManager } from '@/lib/use-template-manager'
import TemplateList from './template-list'
import TemplateManagerDialogs from './template-manager-dialogs'
import type { TemplateRef } from './template-picker'

type PagesPanelProps = {
  themeId: string
  value: TemplateRef
  alternates: { template: string; suffix: string }[]
  onPick: (ref: TemplateRef) => void
  onCreate: (kind: AlternateKind) => void
  onManaged: (change: TemplateChange) => void
}

/** The Pages rail panel: the template picker's list, usage counts and manager included. */
export default function PagesPanel({
  themeId,
  value,
  alternates,
  onPick,
  onCreate,
  onManaged,
}: PagesPanelProps) {
  // Hooks
  const manager = useTemplateManager({ themeId, alternates, onChanged: onManaged })
  // Usage counts, fetched each time the panel opens (the picker does it on open too).
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per mount, not per render.
  useEffect(() => manager.refresh(), [])

  // Render logic
  return (
    <>
      <TemplateList
        value={value}
        alternates={alternates}
        manager={manager}
        onPick={onPick}
        onCreate={onCreate}
        fill
      />
      <TemplateManagerDialogs manager={manager} />
    </>
  )
}
