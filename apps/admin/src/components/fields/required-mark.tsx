'use client'

import { requiredMarkContent } from '@/data/common'
import { useCopy } from '@/hooks/use-copy'

/**
 * The one required-field marker in admin: a red asterisk after the label text, with the word
 * "required" for screen readers in its place. Every form label with a required control uses it.
 */
export default function RequiredMark() {
  // Hooks
  const copy = useCopy(requiredMarkContent)

  return (
    <>
      <span aria-hidden="true" className="text-destructive">
        *
      </span>
      <span className="sr-only">{copy.required}</span>
    </>
  )
}
