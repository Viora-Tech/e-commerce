'use client'

import type {
  CellBlock,
  ColumnsLayoutBlock,
  DesignBlock,
  EmailTemplateDesign,
} from '@commerce/notifications/design'
import { ArrowLeft } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { emailDesignContent } from '@/data/email-design'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy } from '@/hooks/use-copy'
import DesignBoxFields from './design-box-fields'
import DesignFieldsBasic from './design-fields-basic'
import DesignFieldsColumns from './design-fields-columns'
import DesignFieldsMore from './design-fields-more'
import DesignSlotFields from './design-slot-fields'
import { type BlockPatch, blockTitle } from './design-state'

type DesignBlockSettingsProps = {
  design: EmailTemplateDesign
  /** The selected block; null shows a hint to pick one. */
  block: DesignBlock | CellBlock | null
  /** The Columns block around it, when the block sits in a column. */
  parent: ColumnsLayoutBlock | null
  onChange: (patch: BlockPatch) => void
  /** Changes that touch more than the block (the blocks inside a column). */
  onDesign: (design: EmailTemplateDesign) => void
  onSelect: (id: string) => void
}

/** Blocks whose content lines up left, centre or right with the box's alignment. */
const ALIGNED = new Set(['intro', 'heading', 'text', 'image', 'button', 'social', 'hero'])

/**
 * The settings of the selected block: its own fields, then its Layout (background, space,
 * alignment). The order's own blocks take their words and colours; their data stays the order's.
 */
export default function DesignBlockSettings({
  design,
  block,
  parent,
  onChange,
  onDesign,
  onSelect,
}: DesignBlockSettingsProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const more = useCopy(emailDesignFieldsContent)

  // Early returns
  if (!block) return <p className="text-body text-muted-foreground">{copy.editor.noneSelected}</p>

  // Render logic
  const title = blockTitle(block as DesignBlock, copy)
  const fields =
    block.type === 'slot' ? (
      <DesignSlotFields block={block} onChange={(edit) => onChange({ edit })} />
    ) : block.type === 'columns' ? (
      <DesignFieldsColumns design={design} block={block} onDesign={onDesign} onSelect={onSelect} />
    ) : (
      <>
        <DesignFieldsBasic block={block} onChange={onChange} />
        {parent ? null : <DesignFieldsMore block={block} onChange={onChange} />}
      </>
    )

  return (
    <section aria-label={title} className="flex flex-col gap-3">
      {parent ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onSelect(parent.id)}
        >
          <ArrowLeft aria-hidden="true" />
          {more.columns.back}
        </Button>
      ) : null}
      <h3 className="text-card-title">{title}</h3>
      {fields}
      {parent ? null : (
        <DesignBoxFields
          id={`design-${block.id}-box`}
          box={block.box}
          withAlign={ALIGNED.has(block.type)}
          onChange={(box) => onChange({ box })}
        />
      )}
    </section>
  )
}
