import { briefingSentence, greetingWord } from '@/data/home'
import { formatPaise } from '@/lib/money'

type TodayBriefingProps = {
  firstName: string
  ordersToday: number
  salesTodayPaise: number
  toShip: number
  now: Date
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
export default function TodayBriefing({
  firstName,
  ordersToday,
  salesTodayPaise,
  toShip,
  now,
}: TodayBriefingProps) {
  const sentence = briefingSentence({
    greeting: greetingWord(istHour(now)),
    firstName,
    ordersToday,
    salesToday: formatPaise(salesTodayPaise),
    toShip,
  })

  return <p className="text-balance text-page-title text-ink-strong">{sentence}</p>
}
