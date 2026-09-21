import { renderToStaticMarkup } from 'react-dom/server'
import { RichTextRenderer } from './rich-text-renderer'
import type { ConverterRegistry, RichTextValue } from './types'

/**
 * Lexical JSON → HTML string, for emails and feeds. Pure: reuses the React
 * converters through renderToStaticMarkup, so no DOM is needed.
 */
export function richTextToHtml(
  value: RichTextValue | null | undefined,
  converters?: ConverterRegistry,
): string {
  if (!value?.root?.children?.length) return ''
  return renderToStaticMarkup(<RichTextRenderer data={value} converters={converters} />)
}
