'use client'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  type LexicalCommand,
  PASTE_COMMAND,
} from 'lexical'
import { useEffect } from 'react'
import { $createYouTubeNode, YouTubeNode } from '../nodes/youtube-node'
import { parseYouTubeId } from '../utils/url'

export const INSERT_YOUTUBE_COMMAND: LexicalCommand<string> =
  createCommand('INSERT_YOUTUBE_COMMAND')

/** YouTube embeds: an insert command plus auto-embed when a bare video URL is pasted. */
export default function EmbedsPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!editor.hasNodes([YouTubeNode]))
      throw new Error('EmbedsPlugin: YouTubeNode not registered on editor')

    return mergeRegister(
      editor.registerCommand<string>(
        INSERT_YOUTUBE_COMMAND,
        (videoID) => {
          const node = $createYouTubeNode(videoID)
          $insertNodes([node])
          node.insertAfter($createParagraphNode())
          return true
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand<ClipboardEvent>(
        PASTE_COMMAND,
        (event) => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false
          const text = event.clipboardData?.getData('text/plain')?.trim()
          if (!text || /\s/.test(text)) return false
          const id = parseYouTubeId(text)
          if (!id) return false
          event.preventDefault()
          editor.dispatchCommand(INSERT_YOUTUBE_COMMAND, id)
          return true
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    )
  }, [editor])

  return null
}
