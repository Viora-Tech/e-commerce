'use client'

import type { DashboardSummary } from '@commerce/api'
import { FireIcon, Save, TargetIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { sanitizeGoalInput, suggestedGoalPaise } from '@/lib/sales-goal'

type SalesGoalRingProps = {
  month: DashboardSummary['month']
}

/** Kept on this device for now: no store settings column exists for a monthly goal yet. */
const GOAL_COOKIE = 'wc_monthly_goal_paise'
const RING_RADIUS = 15.9155
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function readGoalCookie(): number | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${GOAL_COOKIE}=(\\d+)`))
  const value = match ? Number(match[1]) : null
  return value && value > 0 ? value : null
}

function writeGoalCookie(paise: number): void {
  const maxAge = 60 * 60 * 24 * 365
  // biome-ignore lint/suspicious/noDocumentCookie: per-device preference only, no server settings column for it yet (see PR notes).
  document.cookie = `${GOAL_COOKIE}=${Math.round(paise)}; path=/; max-age=${maxAge}; samesite=lax`
}

export default function SalesGoalRing({ month }: SalesGoalRingProps) {
  // Hooks
  const copy = useCopy(homeContent)
  const fmt = useFormat()
  const [goalPaise, setGoalPaise] = useState<number | null>(() => readGoalCookie())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(false)

  // Event handlers
  const handleEdit = () => {
    const startFrom = goalPaise ?? suggestedGoalPaise(month.lastMonthSalesPaise)
    setDraft(startFrom ? String(Math.round(startFrom / 100)) : '')
    setError(false)
    setEditing(true)
  }

  const handleSave = () => {
    const paise = sanitizeGoalInput(draft)
    if (paise === null) {
      setError(true)
      return
    }
    writeGoalCookie(paise)
    setGoalPaise(paise)
    setEditing(false)
  }

  // Render logic
  const c = copy.goal
  const suggestion = suggestedGoalPaise(month.lastMonthSalesPaise)
  const daysLeft = Math.max(0, month.daysInMonth - month.dayOfMonth)
  const pct = goalPaise ? Math.min(100, Math.round((month.toDatePaise / goalPaise) * 100)) : 0
  const dashoffset = CIRCUMFERENCE - (CIRCUMFERENCE * pct) / 100

  return (
    <DataCard
      title={c.title}
      action={
        !editing ? (
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <TargetIcon aria-hidden="true" />
            {goalPaise ? c.edit : c.setGoal}
          </Button>
        ) : null
      }
    >
      {editing ? (
        <div className="flex flex-col gap-3">
          <Input
            size="lg"
            inputMode="decimal"
            autoFocus
            aria-label={c.inputLabel}
            aria-invalid={error}
            placeholder="50,000"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setError(false)
            }}
          />
          <p
            className={
              error ? 'text-caption text-destructive' : 'text-caption text-muted-foreground'
            }
          >
            {error ? c.inputError : c.inputHelp}
          </p>
          <div className="flex gap-2">
            <Button onClick={handleSave}>
              <Save aria-hidden="true" />
              {c.save}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>
              {c.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex size-36 items-center justify-center">
            <svg viewBox="0 0 36 36" className="size-36 -rotate-90" role="img" aria-label={c.title}>
              <circle
                cx="18"
                cy="18"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="3"
                className="stroke-muted"
              />
              {goalPaise ? (
                <circle
                  cx="18"
                  cy="18"
                  r={RING_RADIUS}
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="stroke-primary transition-[stroke-dashoffset] duration-500"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={dashoffset}
                />
              ) : null}
            </svg>
            <div className="absolute flex flex-col items-center">
              <TargetIcon className="mb-1 size-5 text-muted-foreground" />
              <span className="text-kit-stat font-semibold text-ink-strong tabular-nums">
                {goalPaise ? `${pct}%` : '—'}
              </span>
            </div>
          </div>
          {goalPaise ? (
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-body-strong text-ink-strong">{c.percentDone(pct)}</p>
              <p className="text-caption text-muted-foreground">
                {c.progressOf(fmt.money(month.toDatePaise), fmt.money(goalPaise))} ·{' '}
                {c.daysLeft(daysLeft)}
              </p>
              <p className="text-caption text-muted-foreground">
                {c.projected(fmt.money(month.projectedPaise))}
              </p>
            </div>
          ) : (
            <p className="text-body text-muted-foreground">
              {suggestion ? c.noGoalSuggested(fmt.money(suggestion)) : c.noGoal}
            </p>
          )}
          <div className="flex w-full items-center gap-2 border-border border-t pt-3">
            <FireIcon className="size-4 shrink-0 text-warning" />
            <p className="text-caption text-muted-foreground">
              {month.bestDay
                ? c.record(fmt.money(month.bestDayPaise), fmt.day(month.bestDay))
                : c.noRecord}
            </p>
          </div>
        </div>
      )}
    </DataCard>
  )
}
