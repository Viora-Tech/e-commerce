'use client'

import { $isCodeHighlightNode } from '@lexical/code'
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import {
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from 'lexical'
import { Bold, Code, Italic, Link, Strikethrough, Underline } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { editorContent } from '../content'
import { getDOMRangeRect, hideFloatingElem, setFloatingElemPosition } from '../utils/floating'
import { getSelectedNode } from '../utils/get-selected-node'

type Formats = {
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  code: boolean
  link: boolean
}

const EMPTY: Formats = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  link: false,
}
const copy = editorContent.toolbar

function stopMouseDown(event: React.MouseEvent) {
  event.preventDefault()
}

type ToolbarProps = {
  editor: LexicalEditor
  anchorElem: HTMLElement
  formats: Formats
  setIsLinkEditMode: (edit: boolean) => void
}

function FormatToolbar({ editor, anchorElem, formats, setIsLinkEditMode }: ToolbarProps) {
  const boxRef = useRef<HTMLDivElement | null>(null)

  const $reposition = () => {
    const box = boxRef.current
    const native = window.getSelection()
    const root = editor.getRootElement()
    if (!box) return
    const selection = $getSelection()
    if (selection && native && !native.isCollapsed && root?.contains(native.anchorNode)) {
      setFloatingElemPosition(
        getDOMRangeRect(native, root),
        box,
        anchorElem.getBoundingClientRect(),
      )
    } else {
      hideFloatingElem(box)
    }
  }

  useEffect(() => {
    const scroller = anchorElem.parentElement
    const update = () => editor.getEditorState().read($reposition)
    update()
    window.addEventListener('resize', update)
    scroller?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      scroller?.removeEventListener('scroll', update)
    }
  })

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => editorState.read($reposition)),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          $reposition()
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
    )
  })

  const toggleLink = () => {
    if (formats.link) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      return
    }
    setIsLinkEditMode(true)
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, 'https://')
  }

  const button = (active: boolean, label: string, onClick: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      className={active ? 'editor-btn editor-btn--icon is-active' : 'editor-btn editor-btn--icon'}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={stopMouseDown}
      onClick={onClick}
    >
      {icon}
    </button>
  )

  return (
    <div ref={boxRef} className="editor-floating editor-format-toolbar">
      {button(
        formats.bold,
        copy.bold,
        () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'),
        <Bold size={14} />,
      )}
      {button(
        formats.italic,
        copy.italic,
        () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'),
        <Italic size={14} />,
      )}
      {button(
        formats.underline,
        copy.underline,
        () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline'),
        <Underline size={14} />,
      )}
      {button(
        formats.strikethrough,
        copy.strikethrough,
        () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough'),
        <Strikethrough size={14} />,
      )}
      {button(
        formats.code,
        copy.code,
        () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code'),
        <Code size={14} />,
      )}
      {button(formats.link, copy.link, toggleLink, <Link size={14} />)}
    </div>
  )
}

type FloatingFormatToolbarPluginProps = {
  anchorElem: HTMLElement
  setIsLinkEditMode: (edit: boolean) => void
}

/** Bubble toolbar that appears over a non-empty text selection. */
export function FloatingFormatToolbarPlugin({
  anchorElem,
  setIsLinkEditMode,
}: FloatingFormatToolbarPluginProps) {
  const [editor] = useLexicalComposerContext()
  const [formats, setFormats] = useState<Formats | null>(null)

  useEffect(() => {
    const $update = () => {
      if (editor.isComposing()) return
      const selection = $getSelection()
      const native = window.getSelection()
      const root = editor.getRootElement()
      if (
        native === null ||
        !$isRangeSelection(selection) ||
        root === null ||
        !root.contains(native.anchorNode)
      ) {
        setFormats(null)
        return
      }
      const node = getSelectedNode(selection)
      const rawText = selection.getTextContent()
      if (selection.isCollapsed() || rawText === '' || $isCodeHighlightNode(node)) {
        setFormats(null)
        return
      }
      if (!$isTextNode(node) && !$isParagraphNode(node)) {
        setFormats(null)
        return
      }
      setFormats({
        bold: selection.hasFormat('bold'),
        italic: selection.hasFormat('italic'),
        underline: selection.hasFormat('underline'),
        strikethrough: selection.hasFormat('strikethrough'),
        code: selection.hasFormat('code'),
        link: $findMatchingParent(node, $isLinkNode) !== null,
      })
    }

    const onSelectionChange = () => editor.getEditorState().read($update)
    document.addEventListener('selectionchange', onSelectionChange)
    return mergeRegister(
      () => document.removeEventListener('selectionchange', onSelectionChange),
      editor.registerUpdateListener(({ editorState }) => editorState.read($update)),
      editor.registerRootListener(() => {
        if (editor.getRootElement() === null) setFormats(null)
      }),
    )
  }, [editor])

  if (!formats) return null
  return createPortal(
    <FormatToolbar
      editor={editor}
      anchorElem={anchorElem}
      formats={formats ?? EMPTY}
      setIsLinkEditMode={setIsLinkEditMode}
    />,
    anchorElem,
  )
}
