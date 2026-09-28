import { parseRichText, RichTextRenderer, type RichTextValue } from '@commerce/richtext'
import ElementBox from './element-box'

export type TextProps = { body: RichTextValue | string | null | undefined; style: unknown }

/** Rich text in the theme's `.rte` typography, rendered on the server. */
export default function TextElement({ body, style }: TextProps) {
  // Render logic
  return (
    <ElementBox look={style} className="custom-text">
      <RichTextRenderer data={parseRichText(body)} className="rte" />
    </ElementBox>
  )
}
