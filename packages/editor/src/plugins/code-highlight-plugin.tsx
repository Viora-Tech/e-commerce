'use client'

import { $isCodeNode, CodeNode, registerCodeHighlighting } from '@lexical/code'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getRoot, $isElementNode, type LexicalNode } from 'lexical'
import { useEffect } from 'react'

function $documentHasCodeNode(): boolean {
  const stack: LexicalNode[] = [...$getRoot().getChildren()]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    if ($isCodeNode(node)) return true
    if ($isElementNode(node)) stack.push(...node.getChildren())
  }

  return false
}

/** Registers Prism highlighting only while the document contains a code block. */
export function CodeHighlightPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    let unregister: (() => void) | null = null
    const sync = () => {
      const hasCode = editor.getEditorState().read($documentHasCodeNode)
      if (hasCode && !unregister) unregister = registerCodeHighlighting(editor)
      else if (!hasCode && unregister) {
        unregister()
        unregister = null
      }
    }
    sync()
    const unregisterMutation = editor.registerMutationListener(CodeNode, sync)
    return () => {
      unregisterMutation()
      unregister?.()
    }
  }, [editor])

  return null
}
