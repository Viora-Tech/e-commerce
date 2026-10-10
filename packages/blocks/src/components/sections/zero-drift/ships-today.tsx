'use client'

// Port of sections/ships-today.liquid (+ assets/ships-today.js): a slim strip with a dispatch cut-off countdown, a live in-stock count and up to three promise lines.
import { type ReactNode, useEffect, useState } from 'react'
import { shipsTodayContent as copy } from '../../../data/zero-drift/ships-today'
import { loadMotion } from '../../../lazy-motion'
import { safeHref } from '../../../slot-types'
import { useReducedMotion } from '../../../use-reduced-motion'
import Icon, { isIconName } from '../../icon'

type ShipsTodayProps = {
  cutoffHour: number
  timezoneOffset: number
  beforeText: string
  afterText: string
  countText: string
  collectionHandle: string
  inStock: number
  items: { icon: string; text: ReactNode }[]
}

type Lead = { text: string; afterCutoff: boolean }

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? copy.pm : copy.am
  return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`
}

function formatLeft(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const label = h ? `${h}${copy.hours} ${m ? `${m}${copy.minutes}` : ''}` : `${m}${copy.minutes}`
  return label.trim()
}

/** The lead line for the visitor's clock, read on the store's UTC offset so every visitor sees the store's cut-off. */
function leadFor(
  cutoffHour: number,
  timezoneOffset: number,
  beforeText: string,
  afterText: string,
  now: Date,
): Lead {
  const storeNow = new Date(now.getTime() + (timezoneOffset + now.getTimezoneOffset()) * 60000)
  const cutoff = new Date(storeNow)
  cutoff.setHours(cutoffHour, 0, 0, 0)
  if (storeNow < cutoff) {
    const minutes = Math.max(1, Math.round((cutoff.getTime() - storeNow.getTime()) / 60000))
    return { text: beforeText.replace('{time}', formatLeft(minutes)), afterCutoff: false }
  }
  return { text: afterText.replace('{cutoff}', formatHour(cutoffHour)), afterCutoff: true }
}

export default function ShipsToday({
  cutoffHour,
  timezoneOffset,
  beforeText,
  afterText,
  countText,
  collectionHandle,
  inStock,
  items,
}: ShipsTodayProps) {
  // Hooks
  const reduce = useReducedMotion()
  const [lead, setLead] = useState<Lead>({
    text: beforeText.replace('{time}', copy.timePlaceholder),
    afterCutoff: false,
  })
  const [shown, setShown] = useState(inStock)
  useEffect(() => {
    const tick = () =>
      setLead(leadFor(cutoffHour, timezoneOffset, beforeText, afterText, new Date()))
    tick()
    const timer = setInterval(tick, copy.tickMs)
    return () => clearInterval(timer)
  }, [cutoffHour, timezoneOffset, beforeText, afterText])
  useEffect(() => {
    if (reduce || inStock < copy.countUpFrom) {
      setShown(inStock)
      return
    }
    let stop: (() => void) | undefined
    let live = true
    setShown(0)
    loadMotion()
      .then(({ animate }) => {
        if (!live) return
        const run = animate(0, inStock, {
          duration: copy.countUpSeconds,
          ease: 'easeOut',
          onUpdate: (v: number) => setShown(Math.round(v)),
        })
        stop = () => run.stop()
      })
      .catch(() => setShown(inStock))
    return () => {
      live = false
      stop?.()
    }
  }, [inStock, reduce])

  // Render logic
  const countHref = safeHref(`/collections/${collectionHandle}`)

  return (
    <div className={`ships-today${lead.afterCutoff ? ' is-after-cutoff' : ''}`}>
      <p className="ships-today__lead">
        <Icon name="clock" size={18} />
        <span>{lead.text}</span>
      </p>
      {inStock > 0 && collectionHandle ? (
        <p className="ships-today__count">
          <Icon name="stock" size={18} />
          <a href={countHref ?? '#'}>{countText.replace('{count}', String(shown))}</a>
        </p>
      ) : null}
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: promise lines have no id and are reordered only in the editor.
        <p className="ships-today__item" key={i}>
          {isIconName(item.icon) ? <Icon name={item.icon} size={18} /> : null}
          <span>{item.text}</span>
        </p>
      ))}
    </div>
  )
}
