'use client'

import { cn } from '@commerce/ui/lib/utils'
import { staffContent } from '@/data/staff'
import { useCopy } from '@/hooks/use-copy'
import { LEVEL_DOT, LEVEL_TEXT } from './level-tone'
import type { Level, LevelCounts } from './role-access'

type RoleLevelSummaryProps = {
  counts: LevelCounts
  /** The owner role never asks: no Ask first count. */
  showAsk: boolean
  className?: string
}

const ORDER: Level[] = ['allowed', 'ask', 'off']

/** "● 12 allowed  ● 5 ask first  ○ 20 off": a role's permissions at a glance. */
export default function RoleLevelSummary({ counts, showAsk, className }: RoleLevelSummaryProps) {
  // Hooks
  const copy = useCopy(staffContent)

  // Render logic
  const levels = showAsk ? ORDER : ORDER.filter((l) => l !== 'ask')

  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-caption', className)}>
      {levels.map((level) => (
        <span
          key={level}
          className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', LEVEL_TEXT[level])}
        >
          <span
            aria-hidden="true"
            className={cn('size-2 shrink-0 rounded-full', LEVEL_DOT[level])}
          />
          {copy.roles.summary[level](counts[level])}
        </span>
      ))}
    </p>
  )
}
