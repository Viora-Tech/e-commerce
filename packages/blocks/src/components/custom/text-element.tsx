import type { ReactNode } from 'react'
import RichCopy from '../rich-copy'
import ElementBox from './element-box'

export type TextProps = {
  /** Richtext HTML, or a legacy plain string or Lexical JSON (`RichCopy` reads all three). */
  body: ReactNode | object
  style: unknown
}

/** Rich text in the theme's `.rte` typography, rendered on the server. */
export default function TextElement({ body, style }: TextProps) {
  // Render logic
  return (
    <ElementBox look={style} className="custom-text">
      <RichCopy value={body} className="rte" />
    </ElementBox>
  )
}
