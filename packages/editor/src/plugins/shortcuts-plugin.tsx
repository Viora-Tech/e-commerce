'use client'

import { $createCodeNode } from '@lexical/code'
import { TOGGLE_LINK_COMMAND } from '@lexical/link'
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode'
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  type ElementNode,
  INDENT_CONTENT_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_TAB_COMMAND,
  type LexicalEditor,
  OUTDENT_CONTENT_COMMAND,
} from 'lexical'
import { useEffect } from 'react'

type ShortcutsPluginProps = { onLinkShortcut: () => void }

function setBlock(editor: LexicalEditor, create: () => ElementNode) {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) $setBlocksType(selection, create)
  })
}

/**
 * Ctrl/Cmd+Shift+0..6 headings, 7/8/9 lists, Q quote, C code, H rule; Ctrl+K link;
 * Tab indents instead of leaving the editor.
 */
export function ShortcutsPlugin({ onLinkShortcut }: ShortcutsPluginProps): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const unregisterKeys = editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        const mod = event.ctrlKey || event.metaKey
        if (!mod) return false
        const key = event.key.toLowerCase()

        if (key === 'k' && !event.shiftKey) {
          event.preventDefault()
          onLinkShortcut()
          return true
        }
        if (!event.shiftKey) return false

        switch (key) {
          case '0':
            setBlock(editor, () => $createParagraphNode())
            break
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
            setBlock(editor, () => $createHeadingNode(`h${key}` as HeadingTagType))
            break
          case '7':
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
            break
          case '8':
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
            break
          case '9':
            editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)
            break
          case 'q':
            setBlock(editor, () => $createQuoteNode())
            break
          case 'c':
            setBlock(editor, () => $createCodeNode())
            break
          case 'h':
            editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)
            break
          case 'x':
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
            break
          default:
            return false
        }
        event.preventDefault()
        return true
      },
      COMMAND_PRIORITY_NORMAL,
    )

    const unregisterTab = editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        event.preventDefault()
        return editor.dispatchCommand(
          event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND,
          undefined,
        )
      },
      COMMAND_PRIORITY_NORMAL,
    )

    return () => {
      unregisterKeys()
      unregisterTab()
    }
  }, [editor, onLinkShortcut])

  return null
}
