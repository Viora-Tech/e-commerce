'use client'

import type { RichTextValue } from '@commerce/richtext'
import { CharacterLimitPlugin } from '@lexical/react/LexicalCharacterLimitPlugin'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { TablePlugin } from '@lexical/react/LexicalTablePlugin'
import type { EditorState, SerializedEditorState } from 'lexical'
import { useEffect, useRef, useState } from 'react'
import { editorContent } from './content'
import { type EditorMedia, MediaProvider } from './context/media-context'
import { editorTheme } from './editor-theme'
import { editorNodes } from './nodes'
import { CodeHighlightPlugin } from './plugins/code-highlight-plugin'
import { CollapsiblePlugin } from './plugins/collapsible-plugin'
import { EmbedsPlugin } from './plugins/embeds-plugin'
import { FloatingFormatToolbarPlugin } from './plugins/floating-format-toolbar-plugin'
import { FloatingLinkEditorPlugin } from './plugins/floating-link-editor-plugin'
import { ImagesPlugin } from './plugins/images-plugin'
import { LinksPlugin } from './plugins/links-plugin'
import { TRANSFORMERS } from './plugins/markdown-transformers'
import { ShortcutsPlugin } from './plugins/shortcuts-plugin'
import { TableMenuPlugin } from './plugins/table-menu-plugin'
import { ToolbarPlugin } from './plugins/toolbar-plugin'

export type RichTextEditorProps = {
  /** Lexical JSON. `null` or `undefined` starts an empty document. */
  value: RichTextValue | null | undefined
  onChange: (value: RichTextValue) => void
  placeholder?: string | undefined
  /** Upload / pick hooks from the host. Without them images can still be added by URL. */
  media?: EditorMedia | null | undefined
  /** Soft character limit shown as a counter; text past it is flagged, not blocked. */
  maxLength?: number | undefined
  /** Minimum height of the writing area in px. */
  minHeight?: number | undefined
  readOnly?: boolean | undefined
  className?: string | undefined
  /** Field id for the contentEditable, so a <label htmlFor> can target it. */
  id?: string | undefined
}

function isSameDocument(
  a: RichTextValue | null | undefined,
  b: RichTextValue | null | undefined,
): boolean {
  if (a === b) return true
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** Pushes an external `value` into the editor only when it differs from what the editor last emitted. */
function ExternalValuePlugin({
  value,
  lastEmitted,
}: {
  value: RichTextValue | null | undefined
  lastEmitted: React.RefObject<RichTextValue | null>
}) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    if (!value || isSameDocument(value, lastEmitted.current)) return
    const state = editor.parseEditorState(value as unknown as SerializedEditorState)
    if (!state.isEmpty()) editor.setEditorState(state)
  }, [editor, value, lastEmitted])
  return null
}

function ReadOnlyPlugin({ readOnly }: { readOnly: boolean }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => editor.setEditable(!readOnly), [editor, readOnly])
  return null
}

/**
 * The shared rich-text editor. Emits Lexical JSON that `@commerce/richtext`
 * renders on the server; nothing here assumes a particular host app.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = editorContent.placeholder,
  media,
  maxLength,
  minHeight = 200,
  readOnly = false,
  className,
  id,
}: RichTextEditorProps) {
  const [anchorElem, setAnchorElem] = useState<HTMLDivElement | null>(null)
  const [isLinkEditMode, setIsLinkEditMode] = useState(false)
  const lastEmitted = useRef<RichTextValue | null>(value ?? null)

  const initialConfig = {
    namespace: 'commerce-editor',
    theme: editorTheme,
    nodes: editorNodes,
    editable: !readOnly,
    editorState: value ? JSON.stringify(value) : null,
    onError: (error: Error) => {
      throw error
    },
  }

  const handleChange = (editorState: EditorState) => {
    const next = editorState.toJSON() as unknown as RichTextValue
    lastEmitted.current = next
    onChange(next)
  }

  const rootClass = ['editor-shell', readOnly ? 'editor-shell--readonly' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <MediaProvider media={media}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className={rootClass}>
          {readOnly ? null : <ToolbarPlugin setIsLinkEditMode={setIsLinkEditMode} />}
          <div className="editor-scroller">
            <div className="editor-anchor" ref={setAnchorElem}>
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    id={id}
                    className="editor-input"
                    style={{ minHeight }}
                    aria-placeholder={placeholder}
                    placeholder={<div className="editor-placeholder">{placeholder}</div>}
                  />
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            </div>
          </div>
          {maxLength ? (
            <CharacterLimitPlugin
              maxLength={maxLength}
              charset="UTF-16"
              renderer={({ remainingCharacters }) => (
                <div
                  className={
                    remainingCharacters < 0 ? 'editor-count editor-count--over' : 'editor-count'
                  }
                >
                  {editorContent.characterCount(maxLength - remainingCharacters, maxLength)}
                </div>
              )}
            />
          ) : null}
        </div>

        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
        <ExternalValuePlugin value={value} lastEmitted={lastEmitted} />
        <ReadOnlyPlugin readOnly={readOnly} />
        <HistoryPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <LinksPlugin />
        <TablePlugin hasCellMerge hasCellBackgroundColor={false} />
        <HorizontalRulePlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <CodeHighlightPlugin />
        <ImagesPlugin />
        <EmbedsPlugin />
        <CollapsiblePlugin />
        <ShortcutsPlugin onLinkShortcut={() => setIsLinkEditMode(true)} />
        {anchorElem && !readOnly ? (
          <>
            <FloatingLinkEditorPlugin
              anchorElem={anchorElem}
              isLinkEditMode={isLinkEditMode}
              setIsLinkEditMode={setIsLinkEditMode}
            />
            <FloatingFormatToolbarPlugin
              anchorElem={anchorElem}
              setIsLinkEditMode={setIsLinkEditMode}
            />
            <TableMenuPlugin anchorElem={anchorElem} />
          </>
        ) : null}
      </LexicalComposer>
    </MediaProvider>
  )
}
