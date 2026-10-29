'use client'

import type { RolloutConflict } from '@commerce/core'
import { CircleAlert, TriangleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import Link from 'next/link'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type RolloutConflictsBannerProps = {
  conflicts: RolloutConflict[]
}

/**
 * Clashes with other rollouts: "Resolve rollout conflicts" when the save is refused, "Review
 * rollout conflicts" when it only warns (the theme to publish is gone).
 */
export default function RolloutConflictsBanner({ conflicts }: RolloutConflictsBannerProps) {
  // Hooks
  const { conflicts: copy } = useCopy(rolloutsContent).form

  // Early returns
  if (conflicts.length === 0) return null

  // Render logic
  const blocking = conflicts.some((c) => c.level === 'block')
  const Icon = blocking ? CircleAlert : TriangleAlert

  return (
    <Alert variant={blocking ? 'destructive' : 'default'}>
      <Icon />
      <AlertTitle>{blocking ? copy.block : copy.warn}</AlertTitle>
      <AlertDescription>
        <ul className="flex flex-col gap-1">
          {conflicts.map((c) => (
            <li key={`${c.rolloutId}-${c.message}`}>
              {c.message}{' '}
              {c.rolloutId ? (
                <Link
                  href={routes.settings.rollout(c.rolloutId)}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {copy.open(c.rolloutName)}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
