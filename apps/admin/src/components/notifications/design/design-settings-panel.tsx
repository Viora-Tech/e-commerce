'use client'

import { type EmailTemplateDesign, unknownVariables } from '@commerce/notifications/design'
import { useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { emailDesignContent } from '@/data/email-design'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy } from '@/hooks/use-copy'
import DesignBlockSettings from './design-block-settings'
import { findBlock } from './design-cells'
import { blockProblem, blockTitle, updateBlock } from './design-state'
import DesignStylesPanel from './design-styles-panel'
import DesignVariables from './design-variables'

type DesignSettingsPanelProps = {
  design: EmailTemplateDesign
  variables: readonly string[]
  selected: string | null
  /** `group` folds a run of typing into one undo step. */
  onChange: (design: EmailTemplateDesign, group?: string) => void
  onSelect: (id: string) => void
}

type Tab = 'block' | 'styles'

/**
 * The editor's right side: the selected block's settings, or the whole email's styles, and the
 * words that fill in.
 */
export default function DesignSettingsPanel({
  design,
  variables,
  selected,
  onChange,
  onSelect,
}: DesignSettingsPanelProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const more = useCopy(emailDesignFieldsContent)
  const [tab, setTab] = useState<Tab>('block')

  // Event handlers
  const handleSelect = (id: string) => {
    setTab('block')
    onSelect(id)
  }

  // Render logic
  const found = findBlock(design, selected)
  const block = found?.block ?? null
  const unknown = [
    ...new Set([
      ...unknownVariables(design.subject ?? '', variables),
      ...(block ? (blockProblem(block, variables)?.unknown ?? []) : []),
    ]),
  ]

  return (
    <section aria-label={copy.editor.settings} className="flex flex-col gap-5">
      <PillTabs
        label={more.tabs.label}
        tabs={[
          { value: 'block' as const, label: more.tabs.block },
          { value: 'styles' as const, label: more.tabs.styles },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
        {tab === 'styles' ? (
          <DesignStylesPanel design={design} onChange={onChange} />
        ) : (
          <>
            <h3 className="text-caption font-semibold text-muted-foreground">
              {block ? copy.editor.settingsOf(blockTitle(block, copy)) : copy.editor.settings}
            </h3>
            <DesignBlockSettings
              design={design}
              block={block}
              parent={found?.parent ?? null}
              onChange={(patch) =>
                block && onChange(updateBlock(design, block.id, patch), `block:${block.id}`)
              }
              onDesign={(next) => onChange(next)}
              onSelect={handleSelect}
            />
          </>
        )}
      </div>
      <DesignVariables variables={variables} unknown={unknown} />
    </section>
  )
}
