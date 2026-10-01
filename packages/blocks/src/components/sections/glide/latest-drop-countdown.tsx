'use client'

import { useEffect, useState } from 'react'
import { latestDropContent as copy } from '../../../data/glide/latest-drop'

type LatestDropCountdownProps = { deadline: string }

const SECOND = 1000
const MINUTE = 60
const HOUR = 3600
const DAY = 86400

const pad = (n: number) => String(n).padStart(2, '0')

/** Remaining whole seconds until `deadline`, or null when it is blank, unparseable or past. */
function secondsLeft(deadline: string): number | null {
  const target = Date.parse(deadline)
  if (Number.isNaN(target)) return null
  const left = Math.floor((target - Date.now()) / SECOND)
  return left > 0 ? left : null
}

// Port of assets/countdown.js (<count-down>): days / hrs / min / sec tiles. The server HTML is the
// "00" resting state; once mounted it ticks each second and hides itself when the date is missing,
// unparseable or past.
export default function LatestDropCountdown({ deadline }: LatestDropCountdownProps) {
  // Hooks
  const [left, setLeft] = useState<number | null>(0)
  useEffect(() => {
    setLeft(secondsLeft(deadline))
    const id = window.setInterval(() => setLeft(secondsLeft(deadline)), SECOND)
    return () => window.clearInterval(id)
  }, [deadline])

  // Render logic
  const total = left ?? 0
  const tiles = [
    { label: copy.countdown.days, value: Math.floor(total / DAY) },
    { label: copy.countdown.hours, value: Math.floor((total % DAY) / HOUR) },
    { label: copy.countdown.minutes, value: Math.floor((total % HOUR) / MINUTE) },
    { label: copy.countdown.seconds, value: total % MINUTE },
  ]

  return (
    <div
      className="latest-drop__countdown"
      role="timer"
      aria-label={copy.countdown.label}
      hidden={left === null}
    >
      {tiles.map((tile) => (
        <div key={tile.label} className="latest-drop__countdown-tile">
          <span className="latest-drop__countdown-value">{pad(tile.value)}</span>
          <span className="latest-drop__countdown-label text-caption">{tile.label}</span>
        </div>
      ))}
    </div>
  )
}
