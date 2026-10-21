'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { AppSummary } from './app-card'
import AppLogo from './app-logo'

type AppsHeroProps = {
  /** Apps to feature, already limited to a handful. */
  apps: AppSummary[]
  busyId: string | null
  onInstall: (app: AppSummary) => void
}

/** How long each featured app stays before the next one slides in. */
const AUTOPLAY_MS = 7000

/**
 * Featured apps banner (Figma "Apps · Hero carousel"): one app at a time with previous/next and
 * dots. Each change slides in from the side it came from; it moves on by itself every 7 s and
 * holds while the pointer or focus is inside.
 */
export default function AppsHero({ apps, busyId, onInstall }: AppsHeroProps) {
  // Hooks
  const copy = useCopy(appsContent)
  const [index, setIndex] = useState(0)
  // -1 when the last move went back, 1 when forward: which side the next app slides in from.
  const [dir, setDir] = useState<1 | -1>(1)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || apps.length < 2) return
    const t = setTimeout(() => {
      setDir(1)
      setIndex((index + 1) % apps.length)
    }, AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [paused, apps.length, index])

  // Event handlers
  const handleGo = (to: number, direction: 1 | -1) => {
    setDir(direction)
    setIndex(to)
  }

  const handlePause = () => setPaused(true)

  const handleResume = () => setPaused(false)

  // Early returns
  if (apps.length === 0) return null

  // Render logic
  const current = Math.min(index, apps.length - 1)
  const app = apps[current] as AppSummary
  const slideFrom = dir === 1 ? 'slide-in-from-right-6' : 'slide-in-from-left-6'

  return (
    <section
      aria-label={copy.featured}
      className="flex overflow-hidden rounded-2xl border border-border surface-card"
      onPointerEnter={handlePause}
      onPointerLeave={handleResume}
      onFocus={handlePause}
      onBlur={handleResume}
    >
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2 py-[1.625rem] pr-5 pl-6 pt-[1.875rem] md:pl-11">
        <div
          key={app.id}
          aria-live="polite"
          className={cn(
            'flex flex-col items-start gap-2 animate-in fade-in-0 duration-300 ease-out motion-reduce:animate-none',
            slideFrom,
          )}
        >
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-link">
            {copy.featured}
          </span>
          <h2 className="text-page-title text-ink-strong">{app.name}</h2>
          {app.description ? (
            <p className="max-w-[35rem] text-base text-muted-foreground">{app.description}</p>
          ) : null}
          <div className="flex items-center gap-2.5 pt-1.5">
            <Button loading={busyId === app.id} onClick={() => onInstall(app)}>
              {copy.install}
            </Button>
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href={routes.apps.page(app.id)} />}
            >
              {copy.learnMore}
            </Button>
          </div>
        </div>
        <div className="mt-auto flex items-center gap-3 pt-6">
          <Button
            variant="outline"
            size="icon"
            aria-label={copy.previous}
            disabled={apps.length < 2}
            onClick={() => handleGo((current + apps.length - 1) % apps.length, -1)}
          >
            <ChevronLeftIcon />
          </Button>
          <div className="flex items-center gap-1.5">
            {apps.map((a, i) => (
              <button
                key={a.id}
                type="button"
                aria-label={copy.goTo(i + 1)}
                aria-current={i === current}
                onClick={() => handleGo(i, i < current ? -1 : 1)}
                className={cn(
                  'h-2 rounded-full transition-[width,background-color] duration-200 ease-out motion-reduce:transition-none',
                  i === current
                    ? 'w-[1.375rem] bg-primary'
                    : 'w-2 bg-border hover:bg-border-strong',
                )}
              />
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label={copy.next}
            disabled={apps.length < 2}
            onClick={() => handleGo((current + 1) % apps.length, 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <div className="hidden w-[26.25rem] shrink-0 items-center justify-center bg-gradient-to-b from-primary-soft to-primary-tint md:flex">
        {/* Figma 332:54763: the logo on a soft white disc over the brand wash. */}
        <span
          key={app.id}
          className="flex size-[14.5rem] items-center justify-center rounded-full bg-card/80 shadow-lift animate-in fade-in-0 zoom-in-95 duration-300 ease-out motion-reduce:animate-none"
        >
          <AppLogo id={app.id} icon={app.admin.icon} size={160} />
        </span>
      </div>
    </section>
  )
}
