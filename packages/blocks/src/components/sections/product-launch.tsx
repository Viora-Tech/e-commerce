'use client'

import { type ReactNode, useActionState, useEffect, useId, useState } from 'react'
import { modernSectionsContent } from '../../data/modern-sections'
import type { Link } from '../../sections/framed'
import { safeHref } from '../../slot-types'
import CountdownTiles from '../countdown-tiles'
import type { NewsletterAction, NewsletterState } from './newsletter'

type ProductLaunchProps = {
  badge: ReactNode
  heading: ReactNode
  text: ReactNode
  /** ISO date and time of the launch; before it the countdown, from it the Live state. */
  launchAt: string
  /** Where "Shop now" goes once it is live (the product). */
  liveButton: Link
  liveHeading: ReactNode
  notifyButton: ReactNode
  /** The storefront's sign-up, for "Notify me"; none on the canvas. */
  action?: NewsletterAction | undefined
}

const copy = modernSectionsContent.productLaunch
const idle: NewsletterState = { status: 'idle' }
const noop: NewsletterAction = async () => idle

const isLive = (launchAt: string) => {
  const at = Date.parse(launchAt)
  return !Number.isNaN(at) && at <= Date.now()
}

/**
 * Figma Section / Product launch (704:117556): before the launch a "Dropping soon" tag, the
 * headline, a live countdown and a Notify me field; from launch time the same section turns
 * itself into the Live state with a Shop now button, no edit needed.
 */
export default function ProductLaunch({
  badge,
  heading,
  text,
  launchAt,
  liveButton,
  liveHeading,
  notifyButton,
  action,
}: ProductLaunchProps) {
  // Hooks
  const id = useId()
  const [live, setLive] = useState(false)
  const [state, submit, pending] = useActionState(action ?? noop, idle)

  // The launch can pass while the page is open: check once a second until it does.
  useEffect(() => {
    if (isLive(launchAt)) {
      setLive(true)
      return
    }
    const timer = window.setInterval(() => {
      if (isLive(launchAt)) setLive(true)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [launchAt])

  // Render logic
  const href = safeHref(liveButton?.href)

  return (
    <div className={`product-launch page-width${live ? ' product-launch--live' : ''}`}>
      <span className="product-launch__glow" aria-hidden="true" />
      <span className="product-launch__badge">{live ? copy.liveBadge : badge}</span>
      <div className="product-launch__head">
        {live ? (
          <h2 className="product-launch__heading">{liveHeading}</h2>
        ) : (
          <h2 className="product-launch__heading">{heading}</h2>
        )}
        {text ? <p className="product-launch__text">{text}</p> : null}
      </div>
      {live ? (
        liveButton?.label && href ? (
          <a className="btn btn--primary product-launch__shop" href={href}>
            {liveButton.label}
          </a>
        ) : null
      ) : (
        <>
          <CountdownTiles
            deadline={launchAt}
            labels={copy.labels}
            classes={{
              root: 'product-launch__tiles',
              tile: 'product-launch__tile',
              value: 'product-launch__value',
              label: 'product-launch__unit',
            }}
          />
          {state.status === 'done' ? (
            <p className="product-launch__done" role="status">
              {copy.done}
            </p>
          ) : (
            <form className="product-launch__form" action={submit}>
              <label className="visually-hidden" htmlFor={`${id}-email`}>
                {copy.emailLabel}
              </label>
              <input
                id={`${id}-email`}
                className="product-launch__input"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder={copy.emailPlaceholder}
              />
              <button className="btn btn--primary" type="submit" disabled={pending}>
                {notifyButton}
              </button>
            </form>
          )}
          {state.status === 'error' ? (
            <p className="product-launch__error" role="alert">
              {copy.failed}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
