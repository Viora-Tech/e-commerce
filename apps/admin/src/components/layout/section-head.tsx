import type { ReactNode } from 'react'

type SectionHeadProps = {
  title: ReactNode
  /** One grey line under the title. */
  intro?: ReactNode
  /** Right side, small grey text: a count, a note or a "View all" link. */
  aside?: ReactNode
  /** Right side, a control: tabs or a button. */
  action?: ReactNode
}

/** The title row above a page section: bold title left, optional intro under it, aside or action right. */
export default function SectionHead({ title, intro, aside, action }: SectionHeadProps) {
  // Render logic
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-card-title text-ink-strong">{title}</h2>
        {intro ? <p className="text-caption text-muted-foreground">{intro}</p> : null}
      </div>
      {aside ? <div className="text-body text-muted-foreground">{aside}</div> : null}
      {action}
    </div>
  )
}
