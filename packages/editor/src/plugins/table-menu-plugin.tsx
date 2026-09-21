'use client'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $getTableCellNodeFromLexicalNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableRowNode,
  TableCellHeaderStates,
  type TableCellNode,
} from '@lexical/table'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from 'lexical'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { editorContent } from '../content'

type TableMenuPluginProps = { anchorElem: HTMLElement }

const copy = editorContent.tableMenu

/** A small "⋯" button on the active table cell with row/column actions. */
export function TableMenuPlugin({ anchorElem }: TableMenuPluginProps) {
  const [editor] = useLexicalComposerContext()
  const [cellKey, setCellKey] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const $update = () => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) {
        setCellKey(null)
        return
      }
      const cell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode())
      setCellKey(cell ? cell.getKey() : null)
    }
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        $update()
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor])

  useEffect(() => {
    const box = buttonRef.current
    if (!box) return
    if (!cellKey) {
      box.style.display = 'none'
      setOpen(false)
      return
    }
    const cellDom = editor.getElementByKey(cellKey)
    if (!cellDom) return
    const cellRect = cellDom.getBoundingClientRect()
    const anchorRect = anchorElem.getBoundingClientRect()
    box.style.display = 'block'
    box.style.top = `${cellRect.top - anchorRect.top + 4}px`
    box.style.left = `${cellRect.right - anchorRect.left - 26}px`
  }, [cellKey, editor, anchorElem])

  const run = (fn: () => void) => {
    editor.update(fn)
    setOpen(false)
  }

  const $withCell = (fn: (cell: TableCellNode) => void) => () => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    const cell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode())
    if ($isTableCellNode(cell)) fn(cell)
  }

  const toggleHeaderRow = $withCell((cell) => {
    const row = cell.getParent()
    if (!$isTableRowNode(row)) return
    for (const c of row.getChildren()) {
      if (!$isTableCellNode(c)) continue
      const state = c.__headerState
      c.setHeaderStyles(
        state & TableCellHeaderStates.ROW
          ? state & ~TableCellHeaderStates.ROW
          : state | TableCellHeaderStates.ROW,
        TableCellHeaderStates.ROW,
      )
    }
  })

  const deleteTable = $withCell((cell) => {
    $getTableNodeFromLexicalNodeOrThrow(cell).remove()
  })

  const items: [string, () => void][] = [
    [copy.insertRowAbove, () => $insertTableRowAtSelection(false)],
    [copy.insertRowBelow, () => $insertTableRowAtSelection(true)],
    [copy.insertColumnLeft, () => $insertTableColumnAtSelection(false)],
    [copy.insertColumnRight, () => $insertTableColumnAtSelection(true)],
    [copy.deleteRow, () => $deleteTableRowAtSelection()],
    [copy.deleteColumn, () => $deleteTableColumnAtSelection()],
    [copy.toggleHeaderRow, toggleHeaderRow],
    [copy.deleteTable, deleteTable],
  ]

  return createPortal(
    <div
      ref={buttonRef}
      className="editor-table-menu"
      style={{ display: 'none' }}
      contentEditable={false}
    >
      <button
        type="button"
        className="editor-btn editor-btn--icon editor-btn--raised editor-btn--tiny"
        aria-label="Table options"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={14} />
      </button>
      {open ? (
        <div className="editor-menu">
          {items.map(([label, fn]) => (
            <button
              key={label}
              type="button"
              className="editor-menu__item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(fn)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    anchorElem,
  )
}
