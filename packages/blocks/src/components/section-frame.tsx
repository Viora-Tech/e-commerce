import type { ReactNode } from 'react'

// Port of snippets/section-frame.liquid: colour scheme class + vertical padding.
export function SectionFrame({
  scheme = 'scheme-1',
  padTop = 40,
  padBottom = 40,
  className,
  children,
}: {
  scheme?: string
  padTop?: number
  padBottom?: number
  className?: string
  children: ReactNode
}) {
  const classes = ['section-frame', scheme !== 'scheme-1' ? `color-${scheme}` : null, className]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} style={{ paddingTop: padTop, paddingBottom: padBottom }}>
      {children}
    </div>
  )
}
