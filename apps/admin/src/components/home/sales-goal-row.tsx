'use client'

import type { DashboardSummary } from '@commerce/api'
import { Save, TargetIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { homeContent } from '@/data/home'
import { homeSectionsContent } from '@/data/home-sections'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { sanitizeGoalInput, suggestedGoalPaise } from '@/lib/sales-goal'
import HomeSlimRow from './home-slim-row'
import { SLIM_ROW } from './home-layout'

type SalesGoalRowProps = {
  month: DashboardSummary['month']
}

/** Kept on this device for now: no store settings column exists for a monthly goal yet. */
const GOAL_COOKIE = 'wc_monthly_goal_paise'

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

/**
 * The monthly sales goal as one slim row at the foot of Home (Figma "Home · Redesign 19 Nov"):
 * with no goal, last month's sales, a suggested target and the best day so far, plus "Set a
 * goal"; with a goal, how far along the month is, a thin bar and "Edit goal". Money in whole
 * rupees. Setting it opens an amount box in the same row.
 */
export default function SalesGoalRow({ month }: SalesGoalRowProps) {
  // Hooks
  const copy = useCopy(homeContent)
  const sections = useCopy(homeSectionsContent)
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

  // Early returns
  const c = copy.goal
  if (editing) {
    return (
      <div className={SLIM_ROW}>
        <TargetIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Input
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
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={handleSave}>
            <Save aria-hidden="true" />
            {c.save}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
            {c.cancel}
          </Button>
        </div>
      </div>
    )
  }

  // Render logic
  const suggestion = suggestedGoalPaise(month.lastMonthSalesPaise)
  const record = month.bestDay
    ? c.record(fmt.moneyWhole(month.bestDayPaise), fmt.day(month.bestDay))
    : ''
  const daysLeft = Math.max(0, month.daysInMonth - month.dayOfMonth)
  const pct = goalPaise ? Math.min(100, Math.round((month.toDatePaise / goalPaise) * 100)) : 0
  const lastMonth = fmt.moneyWhole(month.lastMonthSalesPaise)
  const noGoal = suggestion
    ? sections.goal.suggested(lastMonth, fmt.moneyWhole(suggestion))
    : sections.goal.noGoal

  return (
    <HomeSlimRow
      stacked
      icon={<TargetIcon aria-hidden="true" />}
      lead={goalPaise ? `${c.title} · ${c.percentDone(pct)}` : c.title}
      text={
        goalPaise ? (
          <span className="flex flex-col gap-1.5">
            <span>
              {c.progressOf(fmt.moneyWhole(month.toDatePaise), fmt.moneyWhole(goalPaise))} ·{' '}
              {c.daysLeft(daysLeft)}. {c.projected(fmt.moneyWhole(month.projectedPaise))}
            </span>
            <span className="block h-1.5 w-full max-w-[24rem] overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-foreground"
                style={{ width: `${pct}%` }}
              />
            </span>
          </span>
        ) : (
          [noGoal, record].filter(Boolean).join(' ')
        )
      }
      action={
        <Button variant="outline" size="sm" onClick={handleEdit}>
          {goalPaise ? c.edit : c.setGoal}
        </Button>
      }
    />
  )
}
