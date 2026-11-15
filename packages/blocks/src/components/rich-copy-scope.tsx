'use client'

import type { ReactNode } from 'react'
import { RichCopyClass } from './rich-copy-class'

type RichCopyScopeProps = {
  className?: string | undefined
  children: ReactNode
}

/**
 * Hands `RichCopy`'s class to the `RichHtml` inside: a client section receives the server's
 * sanitised copy as a reference React resolves only when it draws it, so `RichCopy` cannot set
 * the class on the element itself.
 */
export default function RichCopyScope({ className, children }: RichCopyScopeProps) {
  return <RichCopyClass value={className}>{children}</RichCopyClass>
}
