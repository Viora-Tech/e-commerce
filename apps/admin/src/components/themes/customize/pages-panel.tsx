'use client'

import type { AlternateKind } from '@commerce/core/theme'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { type TemplateChange, useTemplateManager } from '@/lib/use-template-manager'
import PanelTitle from './panel-title'
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

/** The Pages rail panel (Figma 381:5919): "Pages" with "New page" (a new page template), then
 * the template picker's list, usage counts and manager included. */
export default function PagesPanel({
  themeId,
  value,
  alternates,
  onPick,
  onCreate,
  onManaged,
}: PagesPanelProps) {
  // Hooks
  const copy = useCopy(customizeContent.panels)
  const manager = useTemplateManager({ themeId, alternates, onChanged: onManaged })
  // Usage counts, fetched each time the panel opens (the picker does it on open too).
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per mount, not per render.
  useEffect(() => manager.refresh(), [])

  // Render logic
  return (
    <>
      <PanelTitle
        title={copy.pages}
        action={
          <Button variant="outline" onClick={() => onCreate('page')}>
            <Plus aria-hidden />
            {copy.newPage}
          </Button>
        }
      />
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
