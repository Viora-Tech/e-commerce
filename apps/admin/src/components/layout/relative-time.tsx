import { formatDateTime, formatWhen } from '@/lib/format-date'

type RelativeTimeProps = {
  value: Date | string
  className?: string
}

/** "Today, 9:15 pm" / "Yesterday, 4:02 pm" / "3 days ago" / "12 Sept", full date and time on hover. */
export default function RelativeTime({ value, className }: RelativeTimeProps) {
  return (
    <time
      dateTime={new Date(value).toISOString()}
      title={formatDateTime(value)}
      className={className}
    >
      {formatWhen(value)}
    </time>
  )
}
