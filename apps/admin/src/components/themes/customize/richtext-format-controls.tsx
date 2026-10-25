'use client'

import {
  ListBulleted,
  ListNumbered,
  QuoteIcon,
  RuleIcon,
  TextBold,
  TextItalicIcon,
  TextStrikeIcon,
  TextUnderlineIcon,
} from '@commerce/ui/icons'
import { RichTextMenu, type RichtextField } from '@puckeditor/core'
import { customizeContent } from '@/data/customize'

type Editor = Parameters<NonNullable<RichtextField['renderMenu']>>[0]['editor']

type RichtextFormatControlsProps = {
  editor: Editor
  readOnly: boolean
  /** The canvas menu keeps to bold, italic and underline; the panel adds the rest. */
  set: 'inline' | 'full'
}

type Command =
  | 'toggleBold'
  | 'toggleItalic'
  | 'toggleUnderline'
  | 'toggleStrike'
  | 'toggleBulletList'
  | 'toggleOrderedList'
  | 'toggleBlockquote'
  | 'setHorizontalRule'

type Control = {
  key: keyof (typeof customizeContent)['toolbar']['formatting']
  command: Command
  /** The mark or node `isActive` reads; none for a one-off insert (a rule). */
  mark: string | null
  icon: typeof TextBold
  inline: boolean
}

/** In the order Puck's own menu shows them. */
const CONTROLS: Control[] = [
  { key: 'bold', command: 'toggleBold', mark: 'bold', icon: TextBold, inline: true },
  { key: 'italic', command: 'toggleItalic', mark: 'italic', icon: TextItalicIcon, inline: true },
  {
    key: 'underline',
    command: 'toggleUnderline',
    mark: 'underline',
    icon: TextUnderlineIcon,
    inline: true,
  },
  { key: 'strike', command: 'toggleStrike', mark: 'strike', icon: TextStrikeIcon, inline: false },
  {
    key: 'bulletList',
    command: 'toggleBulletList',
    mark: 'bulletList',
    icon: ListBulleted,
    inline: false,
  },
  {
    key: 'orderedList',
    command: 'toggleOrderedList',
    mark: 'orderedList',
    icon: ListNumbered,
    inline: false,
  },
  {
    key: 'quote',
    command: 'toggleBlockquote',
    mark: 'blockquote',
    icon: QuoteIcon,
    inline: false,
  },
  { key: 'rule', command: 'setHorizontalRule', mark: null, icon: RuleIcon, inline: false },
]

const copy = customizeContent.toolbar.formatting

/**
 * The text menus' formatting buttons in Hugeicons glyphs (the editor's icon set), in place of
 * Puck's built-in ones: Puck's `RichTextMenu.Control` with our icon, and only the commands the
 * field's editor actually has (a field without lists shows no list buttons).
 */
export default function RichtextFormatControls({
  editor,
  readOnly,
  set,
}: RichtextFormatControlsProps) {
  // Render logic
  const commands = (editor?.commands ?? {}) as Record<string, unknown>
  const shown = CONTROLS.filter(
    (c) => (set === 'full' || c.inline) && typeof commands[c.command] === 'function',
  )

  return (
    <>
      {shown.map(({ key, command, mark, icon: Icon }) => (
        <RichTextMenu.Control
          key={key}
          title={copy[key]}
          icon={<Icon aria-hidden weight="regular" />}
          active={mark ? editor?.isActive(mark) === true : false}
          disabled={readOnly || !editor}
          onClick={(e) => {
            e.preventDefault()
            const chain = editor?.chain().focus() as unknown as Record<
              string,
              (() => { run: () => boolean }) | undefined
            >
            chain?.[command]?.().run()
          }}
        />
      ))}
    </>
  )
}
