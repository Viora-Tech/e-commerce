'use client'

import { Check } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Progress } from '@commerce/ui/shadcn/progress'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { type SetupItemId, settingsHomeContent } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import SettingsCard from './settings-card'

type Item = { id: SetupItemId; done: boolean }

/**
 * "Get your shop ready" (Proofly): title, "n of N done" chip, progress bar, then one row per step.
 * Each tick comes from real data (the server checks); undone steps get a small "Set up" button.
 */
export default function SetupChecklistCard() {
  // Hooks
  const { checklist: copy } = useCopy(settingsHomeContent)
  const [items, setItems] = useState<Item[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    api.store
      .setupChecklist()
      .then(setItems)
      .catch(() => setFailed(true))
  }, [])

  // Early returns
  if (failed) {
    return (
      <SettingsCard>
        <p className="text-body text-danger">{copy.loadFailed}</p>
      </SettingsCard>
    )
  }

  // Render logic
  const done = items?.filter((i) => i.done).length ?? 0
  const total = items?.length ?? 0
  const percent = total ? Math.round((done / total) * 100) : 0

  return (
    <SettingsCard>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-body font-semibold text-ink-strong">{copy.heading}</h2>
          <p className="text-caption text-muted-foreground">
            {items && done === total ? copy.allDone : copy.help}
          </p>
        </div>
        {items ? (
          <span className="shrink-0 rounded-lg bg-chip-neutral px-2 py-1 text-caption font-medium text-muted-foreground">
            {copy.progress(done, total)}
          </span>
        ) : null}
      </div>
      <Progress value={percent} aria-label={copy.progressLabel} className="mt-4" />
      {items === null ? (
        <div className="mt-4 flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <ul className="mt-2 flex flex-col">
          {items.map((item) => {
            const words = copy.items[item.id]
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b border-hairline py-3 last:border-b-0 last:pb-0"
              >
                {item.done ? (
                  <span
                    role="img"
                    aria-label={copy.doneLabel}
                    className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-action"
                  >
                    <Check aria-hidden="true" className="size-3" />
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="size-5 shrink-0 rounded-full border-2 border-border-strong"
                  />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={cn(
                      'text-body font-semibold',
                      item.done ? 'text-muted-foreground' : 'text-ink-strong',
                    )}
                  >
                    {words.title}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {item.done ? words.done : words.todo}
                  </span>
                </span>
                {item.done ? (
                  <Link href={words.href} className="sr-only">
                    {copy.open}
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={words.href} />}
                    nativeButton={false}
                  >
                    {copy.setUp}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </SettingsCard>
  )
}
