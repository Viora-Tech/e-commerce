'use client'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  createCommand,
  DELETE_CHARACTER_COMMAND,
  type ElementNode,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  type LexicalCommand,
  type RangeSelection,
} from 'lexical'
import { useEffect } from 'react'
import {
  $createCollapsibleContainerNode,
  $createCollapsibleContentNode,
  $createCollapsibleTitleNode,
  $isCollapsibleContainerNode,
  $isCollapsibleContentNode,
  $isCollapsibleTitleNode,
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
} from '../nodes/collapsible-nodes'

export const INSERT_COLLAPSIBLE_COMMAND: LexicalCommand<void> = createCommand(
  'INSERT_COLLAPSIBLE_COMMAND',
)

function $collapsedSelection(): RangeSelection | null {
  const selection = $getSelection()
  return $isRangeSelection(selection) && selection.isCollapsed() ? selection : null
}

function $exitAfter(container: ElementNode): true {
  const next = container.getNextSibling()
  if (next && $isElementNode(next)) {
    next.selectStart()
    return true
  }

  const paragraph = $createParagraphNode()
  container.insertAfter(paragraph)
  paragraph.selectStart()
  return true
}

/** Enter in title → content; Enter on empty last line → exit; Backspace on empty title → unwrap. */
export default function CollapsiblePlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (
      !editor.hasNodes([CollapsibleContainerNode, CollapsibleContentNode, CollapsibleTitleNode])
    ) {
      throw new Error('CollapsiblePlugin: collapsible nodes not registered on editor')
    }

    return mergeRegister(
      editor.registerCommand(
        INSERT_COLLAPSIBLE_COMMAND,
        () => {
          editor.update(() => {
            const selection = $getSelection()
            if (!$isRangeSelection(selection)) return
            const title = $createCollapsibleTitleNode()
            const content = $createCollapsibleContentNode()
            const container = $createCollapsibleContainerNode(true)
            content.append($createParagraphNode())
            container.append(title, content)
            selection.insertNodes([container])
            title.selectStart()
          })
          return true
        },
        COMMAND_PRIORITY_EDITOR,
      ),

      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        () => {
          const selection = $collapsedSelection()
          if (!selection) return false
          const anchor = selection.anchor.getNode()

          const title = $findMatchingParent(anchor, $isCollapsibleTitleNode)
          if (title) {
            const container = title.getParent()
            if (!$isCollapsibleContainerNode(container)) return false
            if (!container.getOpen()) container.setOpen(true)
            const content = container.getChildAtIndex(1)
            if (!$isCollapsibleContentNode(content)) return false
            const first = content.getFirstChild()
            if (first) first.selectStart()
            else {
              const paragraph = $createParagraphNode()
              content.append(paragraph)
              paragraph.selectStart()
            }
            return true
          }

          const content = $findMatchingParent(anchor, $isCollapsibleContentNode)
          if (!content) return false
          const block =
            anchor === content
              ? null
              : ($findMatchingParent(anchor, (n) => n.getParent() === content) ?? anchor)
          if (
            block &&
            $isElementNode(block) &&
            block.getTextContent() === '' &&
            block === content.getLastChild()
          ) {
            const container = content.getParent()
            if (!$isCollapsibleContainerNode(container)) return false
            block.remove()
            const paragraph = $createParagraphNode()
            container.insertAfter(paragraph)
            paragraph.selectStart()
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),

      editor.registerCommand(
        DELETE_CHARACTER_COMMAND,
        (isBackward) => {
          if (!isBackward) return false
          const selection = $collapsedSelection()
          if (!selection) return false
          const title = $findMatchingParent(selection.anchor.getNode(), $isCollapsibleTitleNode)
          if (!title || title.getTextContent().length > 0 || selection.anchor.offset !== 0)
            return false
          const container = title.getParent()
          if (!$isCollapsibleContainerNode(container)) return false
          const content = container.getChildAtIndex(1)
          if ($isCollapsibleContentNode(content)) {
            for (const child of content.getChildren()) container.insertBefore(child)
          }
          container.remove()
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),

      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        () => {
          const selection = $collapsedSelection()
          if (!selection) return false
          const anchor = selection.anchor.getNode()
          const title = $findMatchingParent(anchor, $isCollapsibleTitleNode)
          if (title) {
            const container = title.getParent()
            return $isCollapsibleContainerNode(container) && !container.getOpen()
              ? $exitAfter(container)
              : false
          }
          const content = $findMatchingParent(anchor, $isCollapsibleContentNode)
          if (!content) return false
          const last = content.getLastDescendant()
          if (last !== null) {
            const atEnd =
              selection.anchor.key === last.getKey() &&
              (selection.anchor.type === 'text'
                ? selection.anchor.offset === last.getTextContentSize()
                : selection.anchor.offset === (last as ElementNode).getChildrenSize())
            if (!atEnd) return false
          }
          const container = content.getParent()
          return $isCollapsibleContainerNode(container) ? $exitAfter(container) : false
        },
        COMMAND_PRIORITY_LOW,
      ),

      // Keep the node's `open` in sync when the author clicks the native <summary>.
      editor.registerMutationListener(CollapsibleContainerNode, (mutations) => {
        editor.getEditorState().read(() => {
          for (const [key, type] of mutations) {
            if (type !== 'updated') continue
            const node = editor.getEditorState()._nodeMap.get(key)
            const dom = editor.getElementByKey(key)
            if (
              $isCollapsibleContainerNode(node) &&
              dom instanceof HTMLDetailsElement &&
              node.getOpen() !== dom.open
            ) {
              const isOpen = dom.open
              editor.update(() => node.setOpen(isOpen))
            }
          }
        })
      }),
    )
  }, [editor])

  return null
}
