/** Relative dates in lists and timelines (`lib/format-date.ts`). */
export const datesContent = {
  today: 'Today',
  yesterday: 'Yesterday',
  todayAt: (time: string) => `Today ${time}`,
  yesterdayAt: (time: string) => `Yesterday ${time}`,
  justNow: 'just now',
  minutesAgo: (n: number) => (n === 1 ? '1 minute ago' : `${n} minutes ago`),
  hoursAgo: (n: number) => (n === 1 ? '1 hour ago' : `${n} hours ago`),
  daysAgoShort: (n: number) => (n === 1 ? '1 day ago' : `${n} days ago`),
}
