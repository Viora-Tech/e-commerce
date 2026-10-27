'use client'

import type { TemplateSection } from '@commerce/core/theme'
import type { LiquidBlockItem } from '@commerce/core/theme-import'
import { ChevronLeftIcon, Eye, EyeOff, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { AutoField, type Field } from '@puckeditor/core'
import { motion, useReducedMotion } from 'motion/react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { liquidItemFields } from '@/lib/customize-liquid-blocks'
import {
  liquidBlockRows,
  liquidBlockTypes,
  withLiquidBlockRemoved,
  withLiquidBlockSettings,
  withLiquidBlockToggled,
} from '@/lib/customize-liquid-tree'
import { useCustomizePuck } from '@/lib/customize-puck'
import { locateBlock } from '@/lib/customize-slots'
import { useImportedTheme, useLiquidBlocks } from '@/lib/customize-theme-context'
import InspectorCard from './inspector-card'

type LiquidBlockInspectorProps = {
  section: TemplateSection
  /** The section's name, for the way back. */
  sectionLabel: string
  blockId: string
}

type ArrayFieldShape = { arrayFields?: Record<string, Field> }
type ObjectFieldShape = { objectFields?: Record<string, Field> }

/**
 * The right pane for one block of an imported Shopify section, picked in Layers (Shopify's
 * block view): "‹ Section" back to the section's own settings, the block's name with hide and
 * remove, then only this block type's settings. Every edit replaces the section's props, so it
 * is one undo step and the canvas re-renders the section.
 */
export default function LiquidBlockInspector({
  section,
  sectionLabel,
  blockId,
}: LiquidBlockInspectorProps) {
  // Hooks
  const tree = useCopy(customizeContent.tree)
  const inspector = useCopy(customizeContent.inspector)
  const theme = useImportedTheme()
  const { fields, setFocus } = useLiquidBlocks()
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const reducedMotion = useReducedMotion()

  // Helpers
  const replaceProps = (props: Record<string, unknown>) => {
    const at = locateBlock(data, section.props.id)
    if (!at) return
    dispatch({
      type: 'replace',
      destinationIndex: at.index,
      destinationZone: at.zone,
      data: { ...section, props: { ...props, id: section.props.id } },
    })
  }

  // Render logic
  const sectionType = typeof section.props.sectionType === 'string' ? section.props.sectionType : ''
  const blocks = (
    Array.isArray(section.props.blocks) ? section.props.blocks : []
  ) as LiquidBlockItem[]
  const index = blocks.findIndex((b) => b.id === blockId)
  const block = blocks[index]
  const types = theme ? liquidBlockTypes(theme.schemas[sectionType], theme) : []
  const row = liquidBlockRows(section.props, types)[index]
  const arrayFields = (fields?.[sectionType]?.blocks as ArrayFieldShape | undefined)?.arrayFields
  const settingFields = block
    ? ((liquidItemFields(arrayFields ?? {}, block).settings as ObjectFieldShape | undefined)
        ?.objectFields ?? {})
    : {}
  const entries = Object.entries(settingFields)

  // The block is gone (removed, undone): back to the section.
  if (!block || !row) {
    return null
  }

  return (
    <motion.section
      key={blockId}
      initial={reducedMotion ? false : { opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
      className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain p-4"
      aria-label={inspector.label}
    >
      <button
        type="button"
        onClick={() => setFocus(null)}
        className={`-ml-1 flex items-center gap-1 self-start rounded-md px-1 text-xs leading-[1.0625rem] text-muted-foreground hover:text-foreground ${CHROME_FOCUS}`}
      >
        <ChevronLeftIcon aria-hidden className="size-3.5" />
        {tree.backToSection(sectionLabel)}
      </button>
      <header className="flex shrink-0 items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate text-base leading-[1.4375rem] font-semibold text-foreground">
          {row.title}
        </h2>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          onClick={() => replaceProps(withLiquidBlockToggled(section.props, index))}
          aria-label={row.hidden ? tree.showBlock(row.title) : tree.hideBlock(row.title)}
          title={row.hidden ? tree.showBlock(row.title) : tree.hideBlock(row.title)}
        >
          {row.hidden ? (
            <EyeOff aria-hidden className="size-4" />
          ) : (
            <Eye aria-hidden className="size-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-danger"
          onClick={() => {
            setFocus(null)
            replaceProps(withLiquidBlockRemoved(section.props, index))
          }}
          aria-label={tree.removeBlock(row.title)}
          title={tree.removeBlock(row.title)}
        >
          <Trash2 aria-hidden className="size-4" />
        </Button>
      </header>
      {row.typeName ? (
        <p className="-mt-2.5 text-xs leading-[1.0625rem] text-muted-foreground">{row.typeName}</p>
      ) : null}
      {row.hidden ? (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-[1.0625rem] text-muted-foreground">
          {tree.blockHiddenNote}
        </p>
      ) : null}
      {entries.length > 0 ? (
        <InspectorCard title={inspector.content}>
          {entries.map(([key, field]) => (
            <AutoField
              key={key}
              field={field}
              value={block.settings?.[key]}
              onChange={(value: unknown) =>
                replaceProps(
                  withLiquidBlockSettings(section.props, index, {
                    ...block.settings,
                    [key]: value,
                  }),
                )
              }
            />
          ))}
        </InspectorCard>
      ) : (
        <p className="px-1 text-[0.8125rem] text-muted-foreground">{inspector.emptyFields}</p>
      )}
    </motion.section>
  )
}
