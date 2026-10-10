import type { ReactNode } from 'react'
import RichCopy from './rich-copy'

export type RichTextBlockProps = {
  /** A string in storage, a React node while edited on the canvas. */
  heading: ReactNode
  /** Richtext HTML, or a legacy plain string or Lexical JSON from older pages (`RichCopy` reads all three). */
  body: ReactNode | object
  align: 'left' | 'center'
}

/** The Rich text section inside Zero Drift's `.rte` typography. */
export default function RichTextBlock({ heading, body, align }: RichTextBlockProps) {
  // Render logic
  const className =
    align === 'center' ? 'rich-text-block rich-text-block--center' : 'rich-text-block'
  return (
    <div className={className}>
      {heading ? <h2 className="h2">{heading}</h2> : null}
      <RichCopy value={body} className="rte" />
    </div>
  )
}
