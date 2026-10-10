'use client'

import { CheckIcon, LinkIcon, RotateCcw, X } from '@commerce/ui/icons'
import { RichTextMenu, type RichtextField } from '@puckeditor/core'
import { type FormEvent, type KeyboardEvent, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { normalisePastedUrl } from '@/lib/customize-links'
import RichtextFormatControls from './richtext-format-controls'

type InlineFormatMenuProps = Parameters<NonNullable<RichtextField['renderInlineMenu']>>[0] & {
  /** `full`: the right panel's menu (lists, quote, rule, headings too); `inline` on the canvas. */
  set?: 'inline' | 'full' | undefined
}

const copy = customizeContent.toolbar

/**
 * The rich-text menu on the canvas (`renderInlineMenu` on every richtext field, see
 * `customize-config.tsx`): bold, italic and underline, a link control and clear formatting
 * (Figma "Builder / Block toolbar", State=Text editing, 500:5981); with `set="full"` also the
 * right panel's menu (`field-format-menu.tsx`). The buttons are ours in Phosphor glyphs
 * (`RichtextFormatControls`), not Puck's built-in ones. The link
 * form lives inside the menu (`data-puck-rte-menu`), so typing in it keeps the text selected
 * and the menu open. Links take the same targets the link picker accepts (`normalisePastedUrl`).
 */
export default function InlineFormatMenu({
  editor,
  readOnly,
  set = 'inline',
}: InlineFormatMenuProps) {
  // Hooks
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)

  // Event handlers
  const handleOpen = () => {
    setDraft((editor?.getAttributes('link').href as string | undefined) ?? '')
    setInvalid(false)
  }
  const handleClose = () => {
    setDraft(null)
    editor?.commands.focus()
  }
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editor || draft === null) return
    if (!draft.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setDraft(null)
      return
    }
    const href = normalisePastedUrl(draft)
    if (!href) {
      setInvalid(true)
      return
    }
    // Same tab, like every other link the merchant sets (`newTab` is off by default).
    editor.chain().focus().extendMarkRange('link').setLink({ href, target: null }).run()
    setDraft(null)
  }
  const handleRemove = () => {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run()
    setDraft(null)
  }
  const handleClear = () => {
    editor?.chain().focus().unsetAllMarks().run()
  }
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.key === 'Escape') handleClose()
  }

  // Render logic
  const active = editor?.isActive('link') === true

  return (
    <RichTextMenu>
      <RichTextMenu.Group>
        {set === 'full' && typeof editor?.commands.toggleHeading === 'function' ? (
          <RichTextMenu.HeadingSelect />
        ) : null}
        <RichtextFormatControls editor={editor} readOnly={readOnly} set={set} />
        <button
          type="button"
          onClick={handleOpen}
          disabled={readOnly || !editor}
          aria-label={active ? copy.editLink : copy.link}
          title={active ? copy.editLink : copy.link}
          aria-pressed={active}
        >
          <LinkIcon aria-hidden weight="regular" />
        </button>
        <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 self-center bg-border" />
        <button
          type="button"
          onClick={handleClear}
          disabled={readOnly || !editor}
          aria-label={copy.clearFormatting}
          title={copy.clearFormatting}
        >
          <RotateCcw aria-hidden weight="regular" />
        </button>
      </RichTextMenu.Group>
      {draft === null ? null : (
        <form onSubmit={handleSubmit} className="flex items-center gap-0.5 pl-1">
          <input
            // biome-ignore lint/a11y/noAutofocus: the field opens because the link button was pressed.
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setInvalid(false)
            }}
            onKeyDown={handleKeyDown}
            placeholder={copy.linkPlaceholder}
            aria-label={copy.link}
            aria-invalid={invalid}
            className="h-6 w-56 rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary aria-invalid:border-danger"
          />
          <button type="submit" aria-label={copy.applyLink} title={copy.applyLink}>
            <CheckIcon aria-hidden weight="regular" />
          </button>
          {active ? (
            <button
              type="button"
              onClick={handleRemove}
              aria-label={copy.removeLink}
              title={copy.removeLink}
            >
              <X aria-hidden weight="regular" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              aria-label={copy.cancelLink}
              title={copy.cancelLink}
            >
              <X aria-hidden weight="regular" />
            </button>
          )}
        </form>
      )}
    </RichTextMenu>
  )
}
