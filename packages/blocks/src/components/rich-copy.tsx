import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { asLexical } from '../lexical-html'
import { storedRichtextHtml } from '../richtext-text'
import RichCopyScope from './rich-copy-scope'
import RichHtml from './rich-html'

type RichCopyProps = {
  /**
   * The prop as the section received it: on the storefront the server's sanitised copy
   * (`richtextNode`, a `RichHtml` element), or the stored string, or on older pages the Lexical
   * JSON the retired rich-text field saved; in the Customize editor Puck swaps a `richtext`
   * prop for its own inline editor (a React node).
   */
  value: ReactNode | object
  className?: string | undefined
}

/** Copy the server already sanitised (`../richtext-node.ts`). */
const isSanitised = (value: unknown): value is ReactElement<{ className?: string | undefined }> =>
  isValidElement<{ sanitised?: unknown }>(value) && value.props.sanitised === true

/**
 * A server element on its way into a client component: the browser (and the HTML render) gets
 * it as a lazy reference, resolved when drawn. Only the server's own elements arrive this way.
 */
const isServerElement = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  (value as { $$typeof?: unknown }).$$typeof === Symbol.for('react.lazy')

/**
 * Body copy from a Puck `richtext` field (see `../sections/inline-fields.ts`). Every ported
 * section draws its body text through this one component so editor and storefront agree. It
 * imports no sanitiser: stored values go through `storedRichtextHtml`, which sanitises where
 * `../richtext-html.ts` is loaded (the server, the admin), so client sections in the browser
 * draw only what the server sanitised.
 */
export default function RichCopy({ value, className }: RichCopyProps) {
  // Early returns
  if (value === null || value === undefined || value === false) return null
  if (isSanitised(value)) return cloneElement(value, { className })
  // The server's sanitised copy inside a client section: `RichHtml` takes the class from here.
  if (isServerElement(value)) {
    return <RichCopyScope className={className}>{value as ReactNode}</RichCopyScope>
  }
  if (typeof value !== 'string' && !asLexical(value)) {
    return <div className={className}>{value as ReactNode}</div>
  }

  return <RichHtml html={storedRichtextHtml(value)} className={className} />
}
