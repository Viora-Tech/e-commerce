'use client'

import type { Ref } from 'react'

type DocumentFrameProps = {
  /** A whole HTML document (`printDocument` in core). */
  html: string
  title: string
  className?: string
  ref?: Ref<HTMLIFrameElement> | undefined
  /** Called once the document has loaded, e.g. to open the print dialog. */
  onLoad?: (() => void) | undefined
}

/**
 * A merchant's template, drawn in a sandboxed frame (audit #164): scripts never run, so a
 * template cannot act as the signed-in staff member. Same origin is allowed only so the page can
 * call the frame's own print dialog (`allow-modals`).
 */
export default function DocumentFrame({ html, title, className, ref, onLoad }: DocumentFrameProps) {
  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={html}
      sandbox="allow-same-origin allow-modals"
      referrerPolicy="no-referrer"
      onLoad={onLoad}
      className={className ?? 'h-full w-full rounded-lg border border-border'}
    />
  )
}
