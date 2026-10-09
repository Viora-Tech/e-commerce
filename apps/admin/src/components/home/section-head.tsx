import type { ReactNode } from 'react'

type SectionHeadProps = {
  title: ReactNode
  /** Right side: a count, a note or a "View all" link. */
  aside?: ReactNode
}

/** The title row above each Home section: bold title left, small grey aside right. */
export default function SectionHead({ title, aside }: SectionHeadProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-card-title text-ink-strong">{title}</h2>
      {aside ? <div className="text-caption text-muted-foreground">{aside}</div> : null}
    </div>
  )
}
