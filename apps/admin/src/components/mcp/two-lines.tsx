import { cn } from '@commerce/ui/lib/utils'

type TwoLinesProps = {
  first: string
  second?: string | null
  /** Dark ink for the first line (names); plain for dates and counts. */
  strong?: boolean
}

/** A table cell's two lines: the value, then a grey line under it. */
export default function TwoLines({ first, second, strong = true }: TwoLinesProps) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className={cn('truncate', strong ? 'text-ink-strong' : 'text-foreground')}>
        {first}
      </span>
      {second ? (
        <span className="truncate text-caption text-muted-foreground">{second}</span>
      ) : null}
    </span>
  )
}
