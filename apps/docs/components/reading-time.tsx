import { Clock } from '@phosphor-icons/react/ssr'
import { readingTimeCopy } from '../data/guides'

type ReadingTimeProps = {
  minutes?: number
}

/** "4 min read" above a page's title, from Nextra's `readingTime` front matter. */
export default function ReadingTime({ minutes }: ReadingTimeProps) {
  if (!minutes) return null

  const rounded = Math.max(1, Math.round(minutes))

  return (
    <p
      data-pagefind-ignore="all"
      className="not-prose mt-2 -mb-2 flex items-center gap-1.5 text-[0.8125rem] text-(--docs-muted)"
    >
      <Clock size={14} weight="light" aria-hidden="true" />
      {rounded} {readingTimeCopy.suffix}
    </p>
  )
}
