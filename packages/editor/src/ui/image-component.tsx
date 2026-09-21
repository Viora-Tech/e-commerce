'use client'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import { mergeRegister } from '@lexical/utils'
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type NodeKey,
} from 'lexical'
import { ImageIcon, Pencil, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { editorContent } from '../content'
import { useEditorMedia } from '../context/media-context'
import { $isImageNode } from '../nodes/image-node'

type ImageComponentProps = {
  nodeKey: NodeKey
  src: string
  altText: string
  width: number | null
  showCaption: boolean
}

const copy = editorContent.image

export default function ImageComponent({
  nodeKey,
  src,
  altText,
  width,
  showCaption,
}: ImageComponentProps) {
  // Hooks
  const [editor] = useLexicalComposerContext()
  const media = useEditorMedia()
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey)
  const [editing, setEditing] = useState(!src)
  const [uploading, setUploading] = useState(false)
  const [alt, setAlt] = useState(altText)
  const fileInput = useRef<HTMLInputElement>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const $remove = () => {
      const selection = $getSelection()
      if (!isSelected || !$isNodeSelection(selection)) return false
      const node = $getNodeByKey(nodeKey)
      if ($isImageNode(node)) node.remove()
      return true
    }
    return mergeRegister(
      editor.registerCommand<MouseEvent>(
        CLICK_COMMAND,
        (event) => {
          if (!wrapper.current?.contains(event.target as Node)) return false
          if (!event.shiftKey) clearSelection()
          setSelected(!isSelected)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(KEY_DELETE_COMMAND, $remove, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, $remove, COMMAND_PRIORITY_LOW),
    )
  }, [editor, isSelected, nodeKey, clearSelection, setSelected])

  // Helpers
  const update = (patch: {
    src?: string | undefined
    altText?: string | undefined
    width?: number | undefined
    showCaption?: boolean | undefined
  }) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isImageNode(node)) node.setImage(patch)
    })
  }

  const remove = () => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isImageNode(node)) node.remove()
    })
  }

  const commitAlt = () => {
    if (alt !== altText) update({ altText: alt })
  }

  // Event handlers
  const handleFile = async (file: File | undefined) => {
    if (!file || !media?.upload) return
    setUploading(true)
    try {
      const uploaded = await media.upload(file)
      if (uploaded) {
        update({ src: uploaded.url, altText: uploaded.alt ?? alt, width: uploaded.width })
        if (uploaded.alt) setAlt(uploaded.alt)
        setEditing(false)
      }
    } finally {
      setUploading(false)
    }
  }

  const handlePick = () => {
    media?.pick?.((image) => {
      update({ src: image.url, altText: image.alt ?? alt, width: image.width })
      if (image.alt) setAlt(image.alt)
      setEditing(false)
    })
  }

  const handleUrl = () => {
    const url = window.prompt(copy.urlPrompt, src || 'https://')
    if (url?.trim()) {
      update({ src: url.trim() })
      setEditing(false)
    }
  }

  // Early returns
  if (editing) {
    return (
      <div ref={wrapper} className="editor-image-card" contentEditable={false}>
        <div className="editor-image-card__head">
          <ImageIcon size={14} />
          <span>{copy.edit}</span>
          {src ? (
            <button
              type="button"
              className="editor-btn editor-btn--text"
              onClick={() => setEditing(false)}
            >
              {copy.done}
            </button>
          ) : null}
        </div>
        <div className="editor-image-card__body">
          {src ? <img src={src} alt={alt} className="editor-image-card__preview" /> : null}
          <div className="editor-image-card__actions">
            {media?.upload ? (
              <button
                type="button"
                className="editor-btn"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={14} /> {uploading ? copy.uploading : copy.upload}
              </button>
            ) : null}
            {media?.pick ? (
              <button type="button" className="editor-btn" onClick={handlePick}>
                <ImageIcon size={14} /> {copy.pick}
              </button>
            ) : null}
            <button type="button" className="editor-btn" onClick={handleUrl}>
              {editorContent.toolbar.imageUrl}
            </button>
            {!media?.upload && !media?.pick ? <p className="editor-hint">{copy.noUpload}</p> : null}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          <label className="editor-field">
            <span>{copy.alt}</span>
            <input
              className="editor-input-text"
              value={alt}
              placeholder={copy.altPlaceholder}
              onChange={(e) => setAlt(e.target.value)}
              onBlur={commitAlt}
            />
          </label>
          <label className="editor-check">
            <input
              type="checkbox"
              checked={showCaption}
              onChange={(e) => update({ showCaption: e.target.checked })}
            />
            <span>{copy.caption}</span>
          </label>
          {!src ? (
            <button type="button" className="editor-btn editor-btn--danger" onClick={remove}>
              <Trash2 size={14} /> {copy.remove}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={wrapper}
      className={isSelected ? 'editor-image-view editor-image-view--selected' : 'editor-image-view'}
    >
      <img src={src} alt={altText} width={width ?? undefined} draggable={false} />
      <div
        className={
          isSelected
            ? 'editor-image-view__tools editor-image-view__tools--visible'
            : 'editor-image-view__tools'
        }
        contentEditable={false}
      >
        <button
          type="button"
          className="editor-btn editor-btn--icon editor-btn--raised"
          aria-label={copy.edit}
          onClick={() => setEditing(true)}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="editor-btn editor-btn--icon editor-btn--raised editor-btn--danger"
          aria-label={copy.remove}
          onClick={remove}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {showCaption && altText ? <p className="editor-image-view__caption">{altText}</p> : null}
    </div>
  )
}
