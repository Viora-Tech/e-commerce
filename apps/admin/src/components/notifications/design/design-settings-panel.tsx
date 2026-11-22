'use client'

import { type EmailTemplateDesign, unknownVariables } from '@commerce/notifications/design'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'
import DesignBlockSettings from './design-block-settings'
import { blockProblem, blockTitle, updateBlock } from './design-state'
import DesignVariables from './design-variables'

type DesignSettingsPanelProps = {
  design: EmailTemplateDesign
  variables: readonly string[]
  selected: string | null
  /** `group` folds a run of typing into one undo step. */
  onChange: (design: EmailTemplateDesign, group?: string) => void
}

/** The editor's right side: the selected block's settings and the words that fill in. */
export default function DesignSettingsPanel({
  design,
  variables,
  selected,
  onChange,
}: DesignSettingsPanelProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)

  // Render logic
  const block = design.blocks.find((b) => b.id === selected) ?? null
  const unknown = [
    ...new Set([
      ...unknownVariables(design.subject ?? '', variables),
      ...(block ? (blockProblem(block, variables)?.unknown ?? []) : []),
    ]),
  ]

  return (
    <section aria-label={copy.editor.settings} className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <h3 className="text-caption font-semibold text-muted-foreground">
          {block ? copy.editor.settingsOf(blockTitle(block, copy)) : copy.editor.settings}
        </h3>
        <DesignBlockSettings
          block={block}
          onChange={(patch) =>
            block && onChange(updateBlock(design, block.id, patch), `block:${block.id}`)
          }
        />
      </div>
      <DesignVariables variables={variables} unknown={unknown} />
    </section>
  )
}
