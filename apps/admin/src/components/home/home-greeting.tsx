import { wallClock } from '@commerce/dates'
import { greetingTitle, greetingWord, homeContent, summaryLine } from '@/data/home'
import { getCopy, getLocale } from '@/lib/copy-server'
import { formatters } from '@/lib/format'

type HomeGreetingProps = {
  firstName: string
  ordersToday: number
  salesTodayPaise: number
  toShip: number
  now: Date
}

/**
 * The page's opening: "Good evening, Kuldeep" as the title and one plain sentence from real
 * data under it ("3 orders today worth ₹43,699, 2 need shipping.").
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

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-balance text-page-title text-ink-strong">
        {titleFor(greetingFor(hour), name)}
      </h1>
      <p className="text-body text-muted-foreground">
        {lineFor({ ordersToday, salesToday: fmt.money(salesTodayPaise), toShip })}
      </p>
    </div>
  )
}
