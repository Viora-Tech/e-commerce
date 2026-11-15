'use client'

import { useContext } from 'react'
import { RichCopyClass } from './rich-copy-class'

type RichHtmlProps = {
  /** HTML the server already ran through the richtext allow-list (`richtextNode`). */
  html: string
  className?: string | undefined
  /**
   * Marks the element as sanitised copy for `RichCopy`, which may not see `RichHtml` itself: on
   * the way to the browser the element's type becomes a client reference.
   */
  sanitised?: true | undefined
}

/**
 * Body copy sanitised on the server (`../richtext-node.ts`), as a client component so a client
 * section can receive it and draw it in the browser without the sanitiser. Its class comes from
 * `RichCopy`: set on the element, or through `RichCopyScope` when the element arrives unresolved.
 */
export default function RichHtml({ html, className }: RichHtmlProps) {
  // Hooks
  const scoped = useContext(RichCopyClass)

  // Early returns
  if (!html) return null

  return (
    <div
      className={className ?? scoped}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: built only by richtextNode, which runs the value through richtextHtml's sanitize-html allow-list on the server.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
