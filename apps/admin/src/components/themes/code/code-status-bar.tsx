'use client'

import type { ReactNode } from 'react'

type CodeStatusBarProps = { items: readonly ReactNode[] }

/** The strip under the code (Figma 699:93624): language, encoding, caret, changes. */
export default function CodeStatusBar({ items }: CodeStatusBarProps) {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-card px-4 font-mono text-caption text-muted-foreground">
      {items.map((item, i) =>
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots in a fixed order
        item ? <span key={i}>{item}</span> : null,
      )}
    </footer>
  )
}
