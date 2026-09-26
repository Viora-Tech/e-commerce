'use client'

import { ChevronRight, CircleCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Progress } from '@commerce/ui/shadcn/progress'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { type SetupItemId, settingsHomeContent } from '@/data/settings'
import { api } from '@/lib/api-client'

type Item = { id: SetupItemId; done: boolean }

const copy = settingsHomeContent.checklist

/**
 * "Get your shop ready": the setup checklist with a progress bar. Each item's
 * tick comes from real data (the server checks), and links to its page.
 */
export default function SetupChecklistCard() {
  // Hooks
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
      <Card>
        <CardContent>
          <p className="text-body text-destructive">{copy.loadFailed}</p>
        </CardContent>
      </Card>
    )
  }

  // Render logic
  const done = items?.filter((i) => i.done).length ?? 0
  const total = items?.length ?? 0
  const percent = total ? Math.round((done / total) * 100) : 0

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-card font-semibold text-foreground">{copy.heading}</h2>
          <p className="text-body text-muted-foreground">
            {items && done === total ? copy.allDone : copy.help}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={percent} aria-label={copy.progressLabel} className="flex-1" />
          <span className="shrink-0 text-body font-medium text-foreground">
            {items ? copy.progress(done, total) : null}
          </span>
        </div>
        {items === null ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => {
              const words = copy.items[item.id]
              return (
                <li key={item.id}>
                  <Link
                    href={words.href}
                    className="group flex items-center gap-3 rounded-md py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.done ? (
                      <CircleCheck
                        aria-label={copy.doneLabel}
                        weight="fill"
                        className="size-5 shrink-0 text-success"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="size-5 shrink-0 rounded-full border-2 border-muted-foreground-soft"
                      />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={cn(
                          'text-body font-medium',
                          item.done ? 'text-muted-foreground' : 'text-foreground',
                        )}
                      >
                        {words.title}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {item.done ? words.done : words.todo}
                      </span>
                    </span>
                    <span className="sr-only">{copy.open}</span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
