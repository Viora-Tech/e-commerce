import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  type ElementTransformer,
  MULTILINE_ELEMENT_TRANSFORMERS,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type TextMatchTransformer,
  type Transformer,
} from '@lexical/markdown'
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from '@lexical/react/LexicalHorizontalRuleNode'
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  type TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table'
import { $isParagraphNode, $isTextNode, type LexicalNode } from 'lexical'
import { $createImageNode, $isImageNode, ImageNode } from '../nodes/image-node'

export const HR: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node: LexicalNode) => ($isHorizontalRuleNode(node) ? '***' : null),
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createHorizontalRuleNode()
    if (isImport || parentNode.getNextSibling() != null) parentNode.replace(line)
    else parentNode.insertBefore(line)
    line.selectNext()
  },
  type: 'element',
}

export const IMAGE: TextMatchTransformer = {
  dependencies: [ImageNode],
  export: (node) => ($isImageNode(node) ? `![${node.getAltText()}](${node.getSrc()})` : null),
  importRegExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))/,
  regExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))$/,
  replace: (textNode, match) => {
    const [, altText, src] = match
    textNode.replace($createImageNode({ altText: altText ?? '', src: src ?? '' }))
  },
  trigger: ')',
  type: 'text-match',
}

const TABLE_ROW_REG_EXP = /^(?:\|)(.+)(?:\|)\s?$/
const TABLE_ROW_DIVIDER_REG_EXP = /^(\| ?:?-*:? ?)+\|\s?$/

export const TABLE: ElementTransformer = {
  dependencies: [TableNode, TableRowNode],
  export: (node: LexicalNode) => {
    if (!$isTableNode(node)) return null
    const output: string[] = []
    for (const row of node.getChildren()) {
      if (!$isTableRowNode(row)) continue
      const cells: string[] = []
      let isHeaderRow = false
      for (const cell of row.getChildren()) {
        if (!$isTableCellNode(cell)) continue
        cells.push($convertToMarkdownString(TRANSFORMERS, cell).replace(/\n/g, '\\n').trim())
        if (cell.__headerState === TableCellHeaderStates.ROW) isHeaderRow = true
      }
      output.push(`| ${cells.join(' | ')} |`)
      if (isHeaderRow) output.push(`| ${cells.map(() => '---').join(' | ')} |`)
    }
    return output.join('\n')
  },
  regExp: TABLE_ROW_REG_EXP,
  replace: (parentNode, _1, match) => {
    const line = match[0] ?? ''
    if (TABLE_ROW_DIVIDER_REG_EXP.test(line)) {
      const table = parentNode.getPreviousSibling()
      if (!table || !$isTableNode(table)) return
      const rows = table.getChildren()
      const lastRow = rows[rows.length - 1]
      if (!lastRow || !$isTableRowNode(lastRow)) return
      for (const cell of lastRow.getChildren()) {
        if ($isTableCellNode(cell))
          cell.setHeaderStyles(TableCellHeaderStates.ROW, TableCellHeaderStates.ROW)
      }
      parentNode.remove()
      return
    }

    const matchCells = mapToTableCells(line)
    if (matchCells == null) return
    const rows = [matchCells]
    let sibling = parentNode.getPreviousSibling()
    let maxCells = matchCells.length
    while (sibling) {
      if (!$isParagraphNode(sibling) || sibling.getChildrenSize() !== 1) break
      const firstChild = sibling.getFirstChild()
      if (!$isTextNode(firstChild)) break
      const cells = mapToTableCells(firstChild.getTextContent())
      if (cells == null) break
      maxCells = Math.max(maxCells, cells.length)
      rows.unshift(cells)
      const previous = sibling.getPreviousSibling()
      sibling.remove()
      sibling = previous
    }

    const table = $createTableNode()
    for (const cells of rows) {
      const tableRow = $createTableRowNode()
      table.append(tableRow)
      for (let i = 0; i < maxCells; i++) tableRow.append(cells[i] ?? $createTableCell(''))
    }

    const previous = parentNode.getPreviousSibling()
    if ($isTableNode(previous) && tableColumnCount(previous) === maxCells) {
      previous.append(...table.getChildren())
      parentNode.remove()
    } else {
      parentNode.replace(table)
    }
    table.selectEnd()
  },
  type: 'element',
}

function tableColumnCount(table: TableNode): number {
  const row = table.getFirstChild()
  return $isTableRowNode(row) ? row.getChildrenSize() : 0
}

function $createTableCell(textContent: string): TableCellNode {
  const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS)
  $convertFromMarkdownString(textContent.replace(/\\n/g, '\n'), TRANSFORMERS, cell)
  return cell
}

function mapToTableCells(textContent: string): TableCellNode[] | null {
  const match = textContent.match(TABLE_ROW_REG_EXP)
  if (!match?.[1]) return null
  return match[1].split('|').map((text) => $createTableCell(text))
}

export const TRANSFORMERS: Transformer[] = [
  TABLE,
  HR,
  IMAGE,
  CHECK_LIST,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
]
