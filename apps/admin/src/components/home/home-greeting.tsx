import { wallClock } from '@commerce/dates'
import { greetingTitle, greetingWord, homeContent, summaryLine } from '@/data/home'
import { getCopy, getLocale } from '@/lib/copy-server'
import { formatters } from '@/lib/format'
import GreetingLine from './greeting-line'

type HomeGreetingProps = {
  firstName: string
  ordersToday: number
  salesTodayPaise: number
  toShip: number
  now: Date
}

const DATE_OPTIONS = { weekday: 'short', day: 'numeric', month: 'short' } as const

/**
 * The page's opening: "Good evening, Kuldeep" as the title and one plain sentence from real
 * data under it ("3 orders today worth ₹43,699, 2 need shipping."). The right side shows
 * today's date (the live-visitor count sits once, on the sales card: audit #3); the sentence's
 * two numbers count up once.
 */
export default async function HomeGreeting({
  firstName,
  ordersToday,
  salesTodayPaise,
  toShip,
  now,
}: HomeGreetingProps) {
  // Render logic
  const greetingFor = await getCopy(greetingWord)
  const lineFor = await getCopy(summaryLine)
  const titleFor = await getCopy(greetingTitle)
  const fmt = formatters(await getLocale())
  const hour = wallClock(now).getUTCHours()
  const name = firstName === (await getCopy(homeContent)).briefing.fallbackName ? '' : firstName
  const salesText = fmt.money(salesTodayPaise)

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-left text-page-title text-ink-strong">
          {titleFor(greetingFor(hour), name)}
        </h1>
        <GreetingLine
          line={lineFor({ ordersToday, salesToday: salesText, toShip })}
          salesText={salesText}
          ordersText={String(ordersToday)}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2.5 pt-1.5">
        <span className="text-caption whitespace-nowrap text-muted-foreground">
          {fmt.pattern(now, DATE_OPTIONS)}
        </span>
      </div>
    </div>
  )
}
