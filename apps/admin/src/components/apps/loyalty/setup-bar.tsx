'use client'

import { CheckIcon, CircleDashed } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'

/** The setup steps in order; `live` is the end state (the bar hides then). */
export type SetupStep = 'rate' | 'activate' | 'placements' | 'live'

export type SetupState = {
  /** The program is live (not paused). */
  live: boolean
  /** The live theme has the loyalty widget app embed switched on. */
  placementsOn: boolean
  /** Rewards given back as a percent of spend (0: orders earn nothing yet). */
  ratePercent: number
}

type SetupBarProps = SetupState & {
  /** The one button for the current step; the page decides what it does. */
  action?: ReactNode
}

/** The first step not done yet. */
export function setupStepOf(s: SetupState): SetupStep {
  if (s.ratePercent <= 0) return 'rate'
  if (!s.live) return 'activate'
  if (!s.placementsOn) return 'placements'
  return 'live'
}

/** "2.7%" for 2.7, "1%" for 1. */
export const percentText = (n: number) => `${Math.round(n * 10) / 10}%`

const ORDER: SetupStep[] = ['rate', 'activate', 'placements', 'live']

/**
 * The setup bar Home, Program, Referrals and Placements show at the top (Essential Loyalty's
 * layout): the steps in a row, done ones ticked, then the current step's title, a line of help
 * and the page's button for it. Hidden once every step is done.
 */
export default function SetupBar({ live, placementsOn, ratePercent, action }: SetupBarProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)

  // Helpers
  const label = (s: SetupStep) =>
    s === 'rate' && ratePercent > 0
      ? copy.setup.steps.rateDone(percentText(ratePercent))
      : copy.setup.steps[s]

  // Early returns
  const step = setupStepOf({ live, placementsOn, ratePercent })
  if (step === 'live') return null

  // Render logic
  const c = copy.setup
  const at = ORDER.indexOf(step)
  const current = c.current[step]

  return (
    <DataCard>
      <div className="flex flex-col gap-4">
        <ol aria-label={c.label} className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {ORDER.map((s, i) => {
            const done = i < at
            return (
              <li
                key={s}
                aria-current={s === step ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 text-body',
                  s === 'live' && 'sm:ml-auto',
                  done
                    ? 'text-ink-strong'
                    : s === step
                      ? 'text-foreground'
                      : 'text-muted-foreground',
                )}
              >
                {done ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-success text-success-foreground">
                    <CheckIcon className="size-3" />
                  </span>
                ) : (
                  <CircleDashed className="size-5" />
                )}
                <span className={cn(s === step && 'font-medium')}>{label(s)}</span>
              </li>
            )
          })}
        </ol>
        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-2">
              <span className="text-body font-semibold text-ink-strong">{current.title}</span>
              {step === 'rate' ? null : <StatusChip tone="success">{c.ready}</StatusChip>}
            </span>
            <p className="text-body text-muted-foreground">{current.body}</p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
    </DataCard>
  )
}
