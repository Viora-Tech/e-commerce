'use client'

import {
  DESIGN_LIMITS,
  type DesignBlock,
  type EmailTemplateDesign,
  type FreeBlockType,
  unknownVariables,
} from '@commerce/notifications/design'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'
import DesignBlockList from './design-block-list'
import DesignBlockSettings from './design-block-settings'
import DesignPalette from './design-palette'
import { addBlock, blockProblem, newBlock, removeBlock, updateBlock } from './design-state'
import DesignTextField from './design-text-field'
import DesignVariables from './design-variables'

type DesignEditorSidebarProps = {
  design: EmailTemplateDesign
  variables: readonly string[]
  selected: string | null
  onSelect: (id: string | null) => void
  onChange: (design: EmailTemplateDesign) => void
}

/** The editor's left side: subject, blocks to add, the email's blocks in order and the selected one's settings. */
export default function DesignEditorSidebar({
  design,
  variables,
  selected,
  onSelect,
  onChange,
}: DesignEditorSidebarProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)

  // Event handlers
  const handleAdd = (type: FreeBlockType) => {
    const block = newBlock(type)
    onChange(addBlock(design, block, selected ?? undefined))
    onSelect(block.id)
  }

  const handleRemove = (id: string) => {
    onChange(removeBlock(design, id))
    if (selected === id) onSelect(null)
  }

  const handleReorder = (blocks: DesignBlock[]) => onChange({ ...design, blocks })

  // Render logic
  const block = design.blocks.find((b) => b.id === selected) ?? null
  const unknown = [
    ...new Set([
      ...unknownVariables(design.subject ?? '', variables),
      ...(block ? (blockProblem(block, variables)?.unknown ?? []) : []),
    ]),
  ]

  return (
    <div className="flex flex-col gap-5">
      <DesignTextField
        id="design-subject"
        label={copy.editor.subject}
        value={design.subject ?? ''}
        hint={copy.editor.subjectHint}
        maxLength={DESIGN_LIMITS.subject}
        onChange={(subject) => onChange({ ...design, subject: subject || undefined })}
      />
      <DesignPalette onAdd={handleAdd} />
      <DesignBlockList
        blocks={design.blocks}
        selected={selected}
        variables={variables}
        onReorder={handleReorder}
        onSelect={onSelect}
        onRemove={handleRemove}
      />
      <div className="rounded-lg border border-border p-3">
        <DesignBlockSettings
          block={block}
          onChange={(patch) => block && onChange(updateBlock(design, block.id, patch))}
        />
      </div>
      <DesignVariables variables={variables} unknown={unknown} />
    </div>
  )
}
