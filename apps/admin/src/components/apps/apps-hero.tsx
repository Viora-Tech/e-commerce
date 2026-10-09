'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import type { AppSummary } from './app-card'
import AppLogo from './app-logo'

type AppsHeroProps = {
  /** Apps to feature, already limited to a handful. */
  apps: AppSummary[]
  busyId: string | null
  onInstall: (app: AppSummary) => void
}

/** Featured apps banner (Figma "Apps · Hero carousel"): one app at a time with previous/next and dots. */
export default function AppsHero({ apps, busyId, onInstall }: AppsHeroProps) {
  // Hooks
  const copy = useCopy(appsContent)
  const [index, setIndex] = useState(0)

  // Early returns
  if (apps.length === 0) return null

  // Render logic
  const current = Math.min(index, apps.length - 1)
  const app = apps[current] as AppSummary

  return (
    <section
      aria-label={copy.featured}
      className="flex overflow-hidden rounded-2xl border border-border surface-card"
    >
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2 py-[1.625rem] pr-5 pl-6 pt-[1.875rem] md:pl-11">
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
        </div>
        <div className="mt-auto flex items-center gap-3 pt-6">
          <Button
            variant="outline"
            size="icon"
            aria-label={copy.previous}
            disabled={apps.length < 2}
            onClick={() => setIndex((current + apps.length - 1) % apps.length)}
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
                onClick={() => setIndex(i)}
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
            onClick={() => setIndex((current + 1) % apps.length)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <div className="hidden w-[26.25rem] shrink-0 items-center justify-center bg-gradient-to-b from-primary-soft to-primary-tint md:flex">
        <AppLogo id={app.id} icon={app.admin.icon} size={160} />
      </div>
    </section>
  )
}
