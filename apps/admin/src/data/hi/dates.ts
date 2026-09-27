import { datesContent } from '@/data/dates'
import { translation } from '@/lib/i18n'

export default [
  translation(datesContent, {
    today: 'आज',
    yesterday: 'कल',
    todayAt: (time) => `आज, ${time}`,
    yesterdayAt: (time) => `कल, ${time}`,
    daysAgo: (n) => `${n} दिन पहले`,
    justNow: 'अभी-अभी',
    minutesAgo: (n) => `${n} मिनट पहले`,
    hoursAgo: (n) => `${n} घंटे पहले`,
    daysAgoShort: (n) => `${n} दिन पहले`,
  }),
]
