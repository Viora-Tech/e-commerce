'use client'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  createCommand,
  DROP_COMMAND,
  type LexicalCommand,
  type LexicalEditor,
  PASTE_COMMAND,
} from 'lexical'
import { useEffect } from 'react'
import { useEditorMedia } from '../context/media-context'
import { $createImageNode, type ImageData, ImageNode } from '../nodes/image-node'

export const INSERT_IMAGE_COMMAND: LexicalCommand<ImageData> = createCommand('INSERT_IMAGE_COMMAND')

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
])

function imageFiles(transfer: DataTransfer | null): File[] {
  if (!transfer) return []
  return Array.from(transfer.files).filter((f) => IMAGE_TYPES.has(f.type))
}

/**
 * Registers INSERT_IMAGE_COMMAND and turns dropped or pasted image files into
 * image nodes, uploading through the host's media hook when one is provided.
 */
export function ImagesPlugin(): null {
  const [editor] = useLexicalComposerContext()
  const media = useEditorMedia()

  useEffect(() => {
    if (!editor.hasNodes([ImageNode]))
      throw new Error('ImagesPlugin: ImageNode not registered on editor')

    const insertFiles = (files: File[]) => {
      for (const file of files) insertFromFile(editor, file, media?.upload)
    }

    return mergeRegister(
      editor.registerCommand<ImageData>(
        INSERT_IMAGE_COMMAND,
        (data) => {
          const node = $createImageNode(data)
          $insertNodes([node])
          node.insertAfter($createParagraphNode())
          return true
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand<DragEvent>(
        DROP_COMMAND,
        (event) => {
          const files = imageFiles(event.dataTransfer)
          if (files.length === 0) return false
          event.preventDefault()
          insertFiles(files)
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand<ClipboardEvent>(
        PASTE_COMMAND,
        (event) => {
          const files = imageFiles(event.clipboardData)
          if (files.length === 0) return false
          event.preventDefault()
          insertFiles(files)
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    )
  }, [editor, media])

  return null
}

function insertFromFile(
  editor: LexicalEditor,
  file: File,
  upload:
    | ((
        file: File,
      ) => Promise<{ url: string; alt?: string | undefined; width?: number | undefined } | null>)
    | undefined,
): void {
  if (!upload) {
    // No uploader: keep a local preview so the author can still see it, and edit later.
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
      src: URL.createObjectURL(file),
      altText: file.name,
    })
    return
  }
  upload(file).then((uploaded) => {
    if (uploaded) {
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
        src: uploaded.url,
        altText: uploaded.alt ?? '',
        width: uploaded.width,
      })
    }
  })
}
