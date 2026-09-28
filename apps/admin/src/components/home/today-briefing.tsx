import { briefingSentence, greetingWord, homeContent } from '@/data/home'
import { getCopy, getLocale } from '@/lib/copy-server'
import { formatters } from '@/lib/format'
import TodaySparkline from './today-sparkline'

type TodayBriefingProps = {
  firstName: string
  ordersToday: number
  salesTodayPaise: number
  toShip: number
  now: Date
  todayHourly: number[]
  yesterdayHourly: number[]
}

/** The hour of the day in the store's clock (India runs one timezone: IST). */
function istHour(now: Date): number {
  const formatted = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(now)
  return Number(formatted) % 24
}

/**
 * One plain-language sentence, built from real data: "Good evening, Kuldeep.
 * 14 orders today worth ₹23,400, 3 need shipping." The home page's opening line.
 */
export default async function TodayBriefing({
  firstName,
  ordersToday,
  salesTodayPaise,
  toShip,
  now,
  todayHourly,
  yesterdayHourly,
}: TodayBriefingProps) {
  // Render logic
  const copy = await getCopy(homeContent)
  const sentenceFor = await getCopy(briefingSentence)
  const greetingFor = await getCopy(greetingWord)
  const fmt = formatters(await getLocale())
  const sentence = sentenceFor({
    greeting: greetingFor(istHour(now)),
    firstName,
    ordersToday,
    salesToday: fmt.money(salesTodayPaise),
    toShip,
  })
  const hasHistory = todayHourly.some((v) => v > 0) || yesterdayHourly.some((v) => v > 0)

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-balance text-page-title text-ink-strong">{sentence}</p>
      {hasHistory ? (
        <div className="flex items-center gap-2">
          <TodaySparkline today={todayHourly} yesterday={yesterdayHourly} />
          <span className="text-caption text-muted-foreground">{copy.charts.todayVsYesterday}</span>
        </div>
      ) : null}
    </div>
  )
}
