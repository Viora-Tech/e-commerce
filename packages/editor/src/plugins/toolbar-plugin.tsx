'use client'

import { $createCodeNode, $isCodeNode } from '@lexical/code'
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
} from '@lexical/list'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode'
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  type HeadingTagType,
} from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { INSERT_TABLE_COMMAND } from '@lexical/table'
import { $findMatchingParent, $getNearestNodeOfType, mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  type ElementFormatType,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type TextFormatType,
  UNDO_COMMAND,
} from 'lexical'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronsDownUp,
  Code,
  ImageIcon,
  Italic,
  Link,
  Minus,
  Plus,
  Redo2,
  Strikethrough,
  Table,
  Underline,
  Undo2,
  Youtube,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { type BlockTypeId, editorContent } from '../content'
import { useEditorMedia } from '../context/media-context'
import { getSelectedNode } from '../utils/get-selected-node'
import { parseYouTubeId } from '../utils/url'
import { INSERT_COLLAPSIBLE_COMMAND } from './collapsible-plugin'
import { INSERT_YOUTUBE_COMMAND } from './embeds-plugin'
import { INSERT_IMAGE_COMMAND } from './images-plugin'

type ToolbarPluginProps = { setIsLinkEditMode: (edit: boolean) => void }

type ToolbarState = {
  blockType: BlockTypeId
  align: ElementFormatType
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  code: boolean
  link: boolean
  canUndo: boolean
  canRedo: boolean
}

const copy = editorContent.toolbar
const BLOCK_OPTIONS = Object.entries(editorContent.blockTypes) as [BlockTypeId, string][]
const TEXT_FORMATS: [TextFormatType, string, React.ReactNode][] = [
  ['bold', copy.bold, <Bold size={15} key="b" />],
  ['italic', copy.italic, <Italic size={15} key="i" />],
  ['underline', copy.underline, <Underline size={15} key="u" />],
  ['strikethrough', copy.strikethrough, <Strikethrough size={15} key="s" />],
  ['code', copy.code, <Code size={15} key="c" />],
]
const ALIGNS: [ElementFormatType, string, React.ReactNode][] = [
  ['left', copy.alignLeft, <AlignLeft size={15} key="l" />],
  ['center', copy.alignCenter, <AlignCenter size={15} key="c" />],
  ['right', copy.alignRight, <AlignRight size={15} key="r" />],
  ['justify', copy.alignJustify, <AlignJustify size={15} key="j" />],
]

function stopMouseDown(event: React.MouseEvent) {
  event.preventDefault()
}

/** Reads block type, alignment and text formats at the current selection. */
function $readToolbarState(prev: ToolbarState): ToolbarState {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return prev
  const anchorNode = selection.anchor.getNode()
  let element =
    anchorNode.getKey() === 'root'
      ? anchorNode
      : $findMatchingParent(anchorNode, (e) => {
          const parent = e.getParent()
          return parent !== null && $isRootOrShadowRoot(parent)
        })
  if (element === null) element = anchorNode.getTopLevelElementOrThrow()

  let blockType: BlockTypeId = 'paragraph'
  if ($isListNode(element)) {
    const parentList = $getNearestNodeOfType<ListNode>(anchorNode, ListNode)
    const listType = parentList ? parentList.getListType() : element.getListType()
    blockType = listType === 'bullet' ? 'bullet' : listType === 'number' ? 'number' : 'check'
  } else if ($isHeadingNode(element)) {
    const tag = element.getTag()
    blockType = tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' ? tag : 'h4'
  } else if ($isCodeNode(element)) {
    blockType = 'code'
  } else if (element.getType() === 'quote') {
    blockType = 'quote'
  }

  const node = getSelectedNode(selection)
  const parent = node.getParent()
  const formatElement = $isElementNode(node) ? node : parent
  const align = ($isElementNode(formatElement) ? formatElement.getFormatType() : 'left') || 'left'

  return {
    ...prev,
    blockType,
    align,
    bold: selection.hasFormat('bold'),
    italic: selection.hasFormat('italic'),
    underline: selection.hasFormat('underline'),
    strikethrough: selection.hasFormat('strikethrough'),
    code: selection.hasFormat('code'),
    link: $isLinkNode(parent) || $isLinkNode(node),
  }
}

const INITIAL: ToolbarState = {
  blockType: 'paragraph',
  align: 'left',
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  link: false,
  canUndo: false,
  canRedo: false,
}

export function ToolbarPlugin({ setIsLinkEditMode }: ToolbarPluginProps) {
  const [editor] = useLexicalComposerContext()
  const media = useEditorMedia()
  const [state, setState] = useState<ToolbarState>(INITIAL)
  const [insertOpen, setInsertOpen] = useState(false)
  // Lexical selectors must run inside editor reads; the ref lets listeners merge
  // without a lazy setState updater that React may call later, outside the read.
  const stateRef = useRef<ToolbarState>(INITIAL)

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const next = $readToolbarState(stateRef.current)
          stateRef.current = next
          setState(next)
          return false
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerUpdateListener(({ editorState }) => {
        const next = editorState.read(() => $readToolbarState(stateRef.current))
        stateRef.current = next
        setState(next)
      }),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (canUndo) => {
          stateRef.current = { ...stateRef.current, canUndo }
          setState(stateRef.current)
          return false
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (canRedo) => {
          stateRef.current = { ...stateRef.current, canRedo }
          setState(stateRef.current)
          return false
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    )
  }, [editor])

  const setBlockType = (type: BlockTypeId) => {
    if (type === 'bullet') return editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    if (type === 'number') return editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    if (type === 'check') return editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      if (type === 'paragraph') $setBlocksType(selection, () => $createParagraphNode())
      else if (type === 'quote') $setBlocksType(selection, () => $createQuoteNode())
      else if (type === 'code') $setBlocksType(selection, () => $createCodeNode())
      else $setBlocksType(selection, () => $createHeadingNode(type as HeadingTagType))
    })
  }

  const toggleLink = () => {
    if (state.link) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      return
    }
    setIsLinkEditMode(true)
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, 'https://')
  }

  const insertImage = () => {
    setInsertOpen(false)
    if (media?.pick) {
      media.pick((image) =>
        editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
          src: image.url,
          altText: image.alt ?? '',
          width: image.width,
        }),
      )
      return
    }
    // No picker: insert an empty image card whose panel offers upload / URL.
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, { src: '', altText: '' })
  }

  const insertYouTube = () => {
    setInsertOpen(false)
    const input = window.prompt(editorContent.youtube.prompt)
    if (!input) return
    const id = parseYouTubeId(input)
    if (!id) {
      window.alert(editorContent.youtube.invalid)
      return
    }
    editor.dispatchCommand(INSERT_YOUTUBE_COMMAND, id)
  }

  const insertTable = () => {
    setInsertOpen(false)
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3', includeHeaders: true })
  }

  const insertItems: [string, () => void, React.ReactNode][] = [
    [copy.image, insertImage, <ImageIcon size={14} key="img" />],
    [copy.youtube, insertYouTube, <Youtube size={14} key="yt" />],
    [copy.table, insertTable, <Table size={14} key="tbl" />],
    [
      copy.collapsible,
      () => {
        setInsertOpen(false)
        editor.dispatchCommand(INSERT_COLLAPSIBLE_COMMAND, undefined)
      },
      <ChevronsDownUp size={14} key="col" />,
    ],
    [
      copy.horizontalRule,
      () => {
        setInsertOpen(false)
        editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)
      },
      <Minus size={14} key="hr" />,
    ],
  ]

  const iconButton = (
    label: string,
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    disabled = false,
  ) => (
    <button
      key={label}
      type="button"
      className={active ? 'editor-btn editor-btn--icon is-active' : 'editor-btn editor-btn--icon'}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onMouseDown={stopMouseDown}
      onClick={onClick}
    >
      {icon}
    </button>
  )

  return (
    <div className="editor-toolbar" role="toolbar">
      {iconButton(
        copy.undo,
        false,
        () => editor.dispatchCommand(UNDO_COMMAND, undefined),
        <Undo2 size={15} />,
        !state.canUndo,
      )}
      {iconButton(
        copy.redo,
        false,
        () => editor.dispatchCommand(REDO_COMMAND, undefined),
        <Redo2 size={15} />,
        !state.canRedo,
      )}
      <span className="editor-toolbar__sep" />
      <select
        className="editor-select"
        aria-label={copy.blockType}
        value={state.blockType}
        onChange={(e) => setBlockType(e.target.value as BlockTypeId)}
      >
        {BLOCK_OPTIONS.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <span className="editor-toolbar__sep" />
      {TEXT_FORMATS.map(([format, label, icon]) =>
        iconButton(
          label,
          state[format as keyof ToolbarState] === true,
          () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format),
          icon,
        ),
      )}
      {iconButton(copy.link, state.link, toggleLink, <Link size={15} />)}
      <span className="editor-toolbar__sep" />
      {ALIGNS.map(([align, label, icon]) =>
        iconButton(
          label,
          state.align === align,
          () => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align),
          icon,
        ),
      )}
      <span className="editor-toolbar__sep" />
      <div className="editor-toolbar__insert">
        <button
          type="button"
          className="editor-btn"
          aria-haspopup="menu"
          aria-expanded={insertOpen}
          onMouseDown={stopMouseDown}
          onClick={() => setInsertOpen((v) => !v)}
        >
          <Plus size={14} /> {copy.insert}
        </button>
        {insertOpen ? (
          <div className="editor-menu" role="menu">
            {insertItems.map(([label, onClick, icon]) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                className="editor-menu__item"
                onMouseDown={stopMouseDown}
                onClick={onClick}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
