import { cn } from '@commerce/ui/lib/utils'
import Eyebrow from './eyebrow'

type SectionHeadingProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  /** `h1` for the page's one main title, `h2` for sections. */
  as?: 'h1' | 'h2'
  size?: 'display' | 'section' | 'subsection'
  align?: 'center' | 'left'
  className?: string
}

const SIZE_CLASS = {
  display: 'text-5xl md:text-display',
  section: 'text-4xl md:text-section',
  subsection: 'text-3xl md:text-subsection',
}

export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  as: Tag = 'h2',
  size = 'section',
  align = 'center',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Tag className={cn('font-semibold text-balance text-foreground', SIZE_CLASS[size])}>
        {title}
      </Tag>
      {subtitle ? (
        <p className="max-w-3xl text-lead text-pretty text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  )
}
