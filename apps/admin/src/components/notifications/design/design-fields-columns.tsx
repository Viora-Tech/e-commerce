'use client'

import {
  CELL_BLOCK_TYPES,
  type CellBlock,
  type ColumnsLayoutBlock,
  DESIGN_LIMITS,
  type EmailTemplateDesign,
} from '@commerce/notifications/design'
import { ArrowDown, ArrowUp, Pencil, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import SwitchRow from '@/components/fields/switch-row'
import { emailDesignContent } from '@/data/email-design'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy } from '@/hooks/use-copy'
import { addCell, moveCell, removeCell, setColumnCount } from './design-cells'
import DesignChoiceField from './design-choice-field'
import { blockSummary, updateBlock } from './design-state'

type DesignFieldsColumnsProps = {
  design: EmailTemplateDesign
  block: ColumnsLayoutBlock
  onDesign: (design: EmailTemplateDesign) => void
  /** Opens a block inside a column in the settings. */
  onSelect: (id: string) => void
}

/** A Columns block: how many, how they line up, and the blocks inside each one. */
export default function DesignFieldsColumns({
  design,
  block,
  onDesign,
  onSelect,
}: DesignFieldsColumnsProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const more = useCopy(emailDesignFieldsContent)

  // Helpers
  const id = (f: string) => `design-${block.id}-${f}`
  const patch = (p: Partial<ColumnsLayoutBlock>) => onDesign(updateBlock(design, block.id, p))
  const name = (cell: CellBlock) => {
    const summary = blockSummary(cell)
    return summary ? `${copy.blocks[cell.type]}: ${summary}` : copy.blocks[cell.type]
  }

  // Event handlers
  const handleAdd = (column: number, type: string) => {
    const r = addCell(design, block.id, column, type as CellBlock['type'])
    onDesign(r.design)
    if (r.id) onSelect(r.id)
  }

  // Render logic
  const c = more.columns
  return (
    <>
      <DesignChoiceField
        id={id('count')}
        label={c.count}
        value={String(block.cells.length)}
        options={[
          { value: '1', label: c.one },
          { value: '2', label: c.two },
          { value: '3', label: c.three },
        ]}
        onChange={(v) => patch(setColumnCount(block, Number(v)))}
      />
      <SwitchRow
        id={id('stack')}
        label={c.stack}
        checked={block.stack}
        onChange={(stack) => patch({ stack })}
      />
      <div className="grid grid-cols-2 gap-2">
        <DesignChoiceField
          id={id('valign')}
          label={c.valign}
          value={block.valign ?? 'top'}
          options={[
            { value: 'top', label: c.top },
            { value: 'middle', label: c.middle },
          ]}
          onChange={(v) => patch({ valign: v === 'middle' ? 'middle' : undefined })}
        />
        <DesignChoiceField
          id={id('gap')}
          label={c.gap}
          value={block.gap ?? 'medium'}
          options={[
            { value: 'small', label: copy.fields.small },
            { value: 'medium', label: copy.fields.medium },
          ]}
          onChange={(v) => patch({ gap: v === 'small' ? 'small' : undefined })}
        />
      </div>
      {block.cells.map((cell, col) => (
        <fieldset
          // biome-ignore lint/suspicious/noArrayIndexKey: columns are positions
          key={col}
          className="flex flex-col gap-2 rounded-md border border-border p-2"
        >
          <legend className="px-1 text-caption font-semibold text-muted-foreground">
            {c.column(col + 1)}
          </legend>
          {cell.length === 0 ? (
            <p className="text-caption text-muted-foreground">{c.empty}</p>
          ) : null}
          <ul className="flex flex-col gap-1">
            {cell.map((child, i) => (
              <li key={child.id} className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-body">{name(child)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={c.edit(name(child))}
                  onClick={() => onSelect(child.id)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={c.moveUp(name(child))}
                  disabled={i === 0}
                  onClick={() => onDesign(moveCell(design, child.id, -1))}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={c.moveDown(name(child))}
                  disabled={i === cell.length - 1}
                  onClick={() => onDesign(moveCell(design, child.id, 1))}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={c.remove(name(child))}
                  onClick={() => onDesign(removeCell(design, child.id))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <NativeSelect
            aria-label={c.addTo(col + 1)}
            value=""
            className="w-full"
            disabled={cell.length >= DESIGN_LIMITS.cell}
            onChange={(e) => e.target.value && handleAdd(col, e.target.value)}
          >
            <NativeSelectOption value="">{c.addTo(col + 1)}</NativeSelectOption>
            {CELL_BLOCK_TYPES.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {copy.blocks[t]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </fieldset>
      ))}
    </>
  )
}
