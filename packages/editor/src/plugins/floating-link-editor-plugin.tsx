'use client'

import { $createLinkNode, $isAutoLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import {
  $getSelection,
  $isLineBreakNode,
  $isRangeSelection,
  type BaseSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ESCAPE_COMMAND,
  type LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from 'lexical'
import { Check, ExternalLink, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { editorContent } from '../content'
import { hideFloatingElem } from '../utils/floating'
import { getSelectedNode } from '../utils/get-selected-node'
import { sanitizeUrl } from '../utils/url'

type FloatingLinkEditorProps = {
  editor: LexicalEditor
  isLink: boolean
  setIsLink: (isLink: boolean) => void
  anchorElem: HTMLElement
  isLinkEditMode: boolean
  setIsLinkEditMode: (edit: boolean) => void
}

const copy = editorContent.link

function stopMouseDown(event: React.MouseEvent) {
  event.preventDefault()
}

function $selectedLinkUrl(): string {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return ''
  const node = getSelectedNode(selection)
  const parent =
    $findMatchingParent(node, $isLinkNode) ?? $findMatchingParent(node, $isAutoLinkNode)
  if (parent) return parent.getURL()
  return $isLinkNode(node) ? node.getURL() : ''
}

function FloatingLinkEditor({
  editor,
  isLink,
  setIsLink,
  anchorElem,
  isLinkEditMode,
  setIsLinkEditMode,
}: FloatingLinkEditorProps) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [draft, setDraft] = useState('https://')
  const [lastSelection, setLastSelection] = useState<BaseSelection | null>(null)

  const $reposition = () => {
    const box = boxRef.current
    if (!box) return
    const selection = $getSelection()
    const url = $selectedLinkUrl()
    setLinkUrl(url)
    const native = window.getSelection()
    const root = editor.getRootElement()
    if (selection && native && root && editor.isEditable() && root.contains(native.anchorNode)) {
      const rect = native.focusNode?.parentElement?.getBoundingClientRect()
      if (rect) {
        const anchorRect = anchorElem.getBoundingClientRect()
        box.style.top = `${rect.bottom - anchorRect.top + 4}px`
        box.style.left = `${Math.max(0, Math.min(rect.left - anchorRect.left, anchorRect.width - box.offsetWidth))}px`
      }
      setLastSelection(selection)
    } else if (document.activeElement !== inputRef.current) {
      hideFloatingElem(box)
      setLastSelection(null)
      setIsLinkEditMode(false)
      setLinkUrl('')
    }
  }

  useEffect(() => {
    const scroller = anchorElem.parentElement
    const update = () => editor.getEditorState().read($reposition)
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
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (!isLink) return false
          setIsLink(false)
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    )
  })

  useEffect(() => {
    if (isLinkEditMode) inputRef.current?.focus()
  }, [isLinkEditMode])

  const submit = () => {
    if (lastSelection === null) return
    editor.update(() => {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, sanitizeUrl(draft))
      // An edited auto-link becomes an explicit link so it stops re-matching.
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const parent = getSelectedNode(selection).getParent()
        if ($isAutoLinkNode(parent)) {
          parent.replace(
            $createLinkNode(parent.getURL(), { rel: parent.__rel, target: parent.__target }),
            true,
          )
        }
      }
    })
    setDraft('https://')
    setIsLinkEditMode(false)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setIsLinkEditMode(false)
    }
  }

  if (!isLink) return null

  return (
    <div ref={boxRef} className="editor-floating editor-link-editor">
      {isLinkEditMode ? (
        <>
          <input
            ref={inputRef}
            className="editor-input-text"
            value={draft}
            placeholder={copy.placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className="editor-btn editor-btn--icon"
            aria-label={copy.cancel}
            onMouseDown={stopMouseDown}
            onClick={() => setIsLinkEditMode(false)}
          >
            <X size={14} />
          </button>
          <button
            type="button"
            className="editor-btn editor-btn--icon"
            aria-label={copy.save}
            onMouseDown={stopMouseDown}
            onClick={submit}
          >
            <Check size={14} />
          </button>
        </>
      ) : (
        <>
          <a
            href={sanitizeUrl(linkUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="editor-link-editor__url"
          >
            {linkUrl}
          </a>
          <button
            type="button"
            className="editor-btn editor-btn--icon"
            aria-label={copy.edit}
            onMouseDown={stopMouseDown}
            onClick={() => {
              setDraft(linkUrl)
              setIsLinkEditMode(true)
            }}
          >
            <Pencil size={14} />
          </button>
          <a
            className="editor-btn editor-btn--icon"
            aria-label={copy.open}
            href={sanitizeUrl(linkUrl)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} />
          </a>
          <button
            type="button"
            className="editor-btn editor-btn--icon"
            aria-label={copy.remove}
            onMouseDown={stopMouseDown}
            onClick={() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)}
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
    </div>
  )
}

type FloatingLinkEditorPluginProps = {
  anchorElem: HTMLElement
  isLinkEditMode: boolean
  setIsLinkEditMode: (edit: boolean) => void
}

/** Shows a small popover under the caret whenever it sits inside a single link. */
export function FloatingLinkEditorPlugin({
  anchorElem,
  isLinkEditMode,
  setIsLinkEditMode,
}: FloatingLinkEditorPluginProps) {
  const [editor] = useLexicalComposerContext()
  const [isLink, setIsLink] = useState(false)

  useEffect(() => {
    const $update = () => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      const focusNode = getSelectedNode(selection)
      const focusLink = $findMatchingParent(focusNode, $isLinkNode)
      const focusAuto = $findMatchingParent(focusNode, $isAutoLinkNode)
      if (!(focusLink || focusAuto)) {
        setIsLink(false)
        return
      }
      // Only one link may be under the selection, otherwise editing is ambiguous.
      const crossesLinks = selection
        .getNodes()
        .filter((node) => !$isLineBreakNode(node))
        .some((node) => {
          const link = $findMatchingParent(node, $isLinkNode)
          const auto = $findMatchingParent(node, $isAutoLinkNode)
          return (
            (focusLink && !focusLink.is(link)) ||
            (link && !link.is(focusLink)) ||
            (focusAuto && !focusAuto.is(auto)) ||
            (auto && !auto.is(focusAuto))
          )
        })
      setIsLink(!crossesLinks)
    }

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => editorState.read($update)),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          $update()
          return false
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CLICK_COMMAND,
        (payload) => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return false
          const link = $findMatchingParent(getSelectedNode(selection), $isLinkNode)
          if ($isLinkNode(link) && (payload.metaKey || payload.ctrlKey)) {
            window.open(link.getURL(), '_blank', 'noopener,noreferrer')
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
    )
  }, [editor])

  return createPortal(
    <FloatingLinkEditor
      editor={editor}
      isLink={isLink}
      setIsLink={setIsLink}
      anchorElem={anchorElem}
      isLinkEditMode={isLinkEditMode}
      setIsLinkEditMode={setIsLinkEditMode}
    />,
    anchorElem,
  )
}
