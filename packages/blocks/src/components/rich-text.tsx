import { parseRichText, RichTextRenderer, type RichTextValue } from '@commerce/richtext'

export type RichTextBlockProps = {
  heading: string
  /** Lexical JSON from the editor, or a legacy plain string from older pages. */
  body: RichTextValue | string | null | undefined
  align: 'left' | 'center'
}

/** Server-rendered rich text inside Glide's `.rte` typography. */
export default function RichTextBlock({ heading, body, align }: RichTextBlockProps) {
  const value = parseRichText(body)
  const className =
    align === 'center' ? 'rich-text-block rich-text-block--center' : 'rich-text-block'
  return (
    <div className={className}>
      {heading ? <h2 className="h2">{heading}</h2> : null}
      <RichTextRenderer data={value} className="rte" />
    </div>
  )
}
