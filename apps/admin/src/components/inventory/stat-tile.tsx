import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import CountUp from '@/components/layout/count-up'

type StatTileProps = {
  title: string
  value: string
  caption: string
  tone?: 'default' | 'error' | 'warning'
}

const TONE = {
  default: 'text-ink-strong',
  error: 'text-destructive',
  warning: 'text-warning-foreground dark:text-warning',
} as const

/* Same 135px tile as the order and product lists (5:2512): title, 32/700 figure, caption. */
export default function StatTile({ title, value, caption, tone = 'default' }: StatTileProps) {
  return (
    <Card gap="none" inset={4} className="h-[8.4375rem] rounded-lg">
      <p className="text-kit-title text-foreground">{title}</p>
      <div className="mt-4 flex items-end gap-2">
        <span className={cn('text-kit-stat tabular-nums', TONE[tone])}>
          <CountUp value={value} />
        </span>
      </div>
      <p className="mt-2 truncate text-kit-body text-muted-foreground">{caption}</p>
    </Card>
  )
}
