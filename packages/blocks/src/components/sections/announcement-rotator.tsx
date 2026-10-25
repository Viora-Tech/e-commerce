'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { announcementBarContent as copy } from '../../data/zero-drift/announcement-bar'
import { cx } from '../../slot-types'
import { useReducedMotion } from '../../use-reduced-motion'
import Icon from '../icon'

type AnnouncementRotatorProps = {
  /** One drawn message per announcement, already linked. */
  items: { key: string; node: ReactNode }[]
  autorotate: boolean
  intervalSeconds: number
}

/**
 * Rotate mode of the announcement bar: one message at a time, crossfading on a timer
 * (theme's per-instance keyframes) with prev/next controls and hover-to-pause (theme's
 * `<announcement-bar>` in header.js). The server render shows the first message, which is
 * also what shoppers with reduced motion keep.
 */
export default function AnnouncementRotator({
  items,
  autorotate,
  intervalSeconds,
}: AnnouncementRotatorProps) {
  // Hooks
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  // Hovering or focusing a message holds it (header.js's hover-to-pause).
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const hold = () => setPaused(true)
    const release = () => setPaused(false)
    track.addEventListener('pointerenter', hold)
    track.addEventListener('pointerleave', release)
    track.addEventListener('focusin', hold)
    track.addEventListener('focusout', release)
    return () => {
      track.removeEventListener('pointerenter', hold)
      track.removeEventListener('pointerleave', release)
      track.removeEventListener('focusin', hold)
      track.removeEventListener('focusout', release)
    }
  }, [])
  useEffect(() => {
    if (!autorotate || items.length < 2 || paused || reduce) return
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % items.length),
      Math.max(1, intervalSeconds) * 1000,
    )
    return () => window.clearInterval(timer)
  }, [autorotate, items.length, paused, reduce, intervalSeconds])

  // Event handlers
  const handleStep = (direction: number) => {
    setIndex((i) => (i + direction + items.length) % items.length)
  }

  // Render logic
  const active = index % Math.max(1, items.length)
  const controls = items.length > 1

  return (
    <>
      {controls ? (
        <button
          type="button"
          className="announcement-bar__control announcement-bar__control--prev"
          aria-label={copy.previous}
          onClick={() => handleStep(-1)}
        >
          <Icon name="arrow" size={12} />
        </button>
      ) : null}
      <div ref={trackRef} className="announcement-bar__track">
        {items.map((item, i) => (
          <div
            key={item.key}
            className={cx('announcement-bar__item', i === active && 'is-active')}
            aria-hidden={i === active ? undefined : true}
            inert={i === active ? undefined : true}
          >
            {item.node}
          </div>
        ))}
      </div>
      {controls ? (
        <button
          type="button"
          className="announcement-bar__control announcement-bar__control--next"
          aria-label={copy.next}
          onClick={() => handleStep(1)}
        >
          <Icon name="arrow" size={12} />
        </button>
      ) : null}
    </>
  )
}
