import type { ReactNode } from 'react'
import { richtextHtml } from '../richtext-html'

type RichCopyProps = {
  /**
   * The prop as the section received it: in the Customize editor Puck swaps a `richtext`
   * prop for its own inline editor (a React node); on the storefront it is the stored string.
   */
  value: ReactNode
  className?: string | undefined
}

/**
 * Body copy from a Puck `richtext` field (see `../sections/inline-fields.ts`). Every ported
 * section draws its body text through this one component so editor and storefront agree.
 */
export default function RichCopy({ value, className }: RichCopyProps) {
  // Early returns
  if (value === null || value === undefined || value === false) return null
  if (typeof value !== 'string') return <div className={className}>{value}</div>
  const html = richtextHtml(value)
  if (!html) return null

  return (
    <div
      className={className}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: richtextHtml escapes legacy text and runs HTML through its sanitize-html allow-list.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
