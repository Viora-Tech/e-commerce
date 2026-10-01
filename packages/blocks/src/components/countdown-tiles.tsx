'use client'

import { useEffect, useState } from 'react'

type CountdownTilesProps = {
  /** ISO date and time; blank, unparseable or past hides the tiles. */
  deadline: string
  labels: { label: string; days: string; hours: string; minutes: string; seconds: string }
  /** Each section keeps its own BEM names (`latest-drop__countdown`, `hero-carousel__countdown`). */
  classes: { root: string; tile: string; value: string; label: string }
}

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

// Port of assets/countdown.js (<count-down>), shared by every section with days / hrs / min /
// sec tiles. The server HTML is the "00" resting state; once mounted it ticks each second and
// hides itself when the date is missing, unparseable or past.
export default function CountdownTiles({ deadline, labels, classes }: CountdownTilesProps) {
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
    { label: labels.days, value: Math.floor(total / DAY) },
    { label: labels.hours, value: Math.floor((total % DAY) / HOUR) },
    { label: labels.minutes, value: Math.floor((total % HOUR) / MINUTE) },
    { label: labels.seconds, value: total % MINUTE },
  ]

  return (
    <div className={classes.root} role="timer" aria-label={labels.label} hidden={left === null}>
      {tiles.map((tile) => (
        <div key={tile.label} className={classes.tile}>
          <span className={classes.value}>{pad(tile.value)}</span>
          <span className={`${classes.label} text-caption`}>{tile.label}</span>
        </div>
      ))}
    </div>
  )
}
