import type { RichtextField } from '@puckeditor/core'

/**
 * SOURCE OF TRUTH KEYWORDS: inlineText, inlineTextarea, inlineRichtext, contentEditable, inline editing
 * WHAT:  The Puck field declarations for text a merchant edits by clicking it on the canvas.
 * WHY:   Inline editing (demo.puckeditor.com feel) is a field flag: with `contentEditable`
 *        Puck hands the section a React node in place of the string while editing, so a
 *        section that uses these must only render the prop, never call string methods on it
 *        or put it in an attribute. Body copy uses Puck's `richtext` (stored as HTML, B/I/U
 *        menu); it is drawn by `components/rich-copy.tsx`, which also reads legacy plain
 *        strings and old Lexical JSON (`../richtext-html.ts`). Section-wide copy that is not
 *        shown on the canvas (alt text, URLs, aria labels) stays a plain `text` field.
 * WHERE: Every section and element on the canvas (`./glide/*`, `./library.tsx`, `./modern.tsx`,
 *        `./custom-*.tsx`, `../puck-config.tsx`); the admin frames the richtext field in
 *        `customize-overrides.tsx`; its B/I/U and link menu sits in the block toolbar
 *        (`block-toolbar.tsx`, `inline-format-menu.tsx`).
 */

/** A one-line text the merchant can also type into on the canvas. */
export const inlineText = (label: string) =>
  ({ type: 'text', label, contentEditable: true }) as const

/** A multi-line plain text the merchant can also type into on the canvas. */
export const inlineTextarea = (label: string) =>
  ({ type: 'textarea', label, contentEditable: true }) as const

/** Body copy with bold, italic, underline, lists and links, editable on the canvas. */
export const inlineRichtext = (label = 'Text') =>
  ({
    type: 'richtext',
    label,
    contentEditable: true,
    // Only what `RICHTEXT_TAGS` lets through to the storefront (`../richtext-html.ts`).
    options: {
      heading: false,
      blockquote: false,
      codeBlock: false,
      code: false,
      horizontalRule: false,
      textAlign: false,
    },
  }) as const

/** The page title is the h1, so section copy starts at h2. */
const LONG_FORM_LEVELS: (2 | 3 | 4)[] = [2, 3, 4]

/** Extra Tiptap extensions for long-form copy; the admin passes its image node. */
export type RichtextExtensions = NonNullable<RichtextField['tiptap']>['extensions']

/**
 * Long-form body copy (the Rich text section, the Text element): the same as `inlineRichtext`
 * plus headings (h2 to h4), quotes and rules, which those blocks offered before, and images
 * when the host passes an image extension (the storefront never edits, so it passes none).
 */
export const inlineRichtextLong = (label = 'Text', extensions?: RichtextExtensions) =>
  ({
    type: 'richtext',
    label,
    contentEditable: true,
    options: {
      heading: { levels: LONG_FORM_LEVELS },
      codeBlock: false,
      code: false,
      textAlign: false,
    },
    ...(extensions?.length ? { tiptap: { extensions } } : {}),
  }) as const
