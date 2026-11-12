'use client'

import type { SetupItemId } from '@commerce/core/setup-tasks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { settingsHomeContent } from '@/data/settings'
import { api } from '@/lib/api-client'
import { type StorageScope, scopedStorageKey, useStorageScope } from '@/lib/storage-scope'
import { useCopy } from './use-copy'

/** Per-browser opt-out ("Don't show again"); a plain first-party preference cookie. */
const SETUP_NEXT_OFF_COOKIE = 'setup_next_off'
const ONE_YEAR = 60 * 60 * 24 * 365

function promptsOff(): boolean {
  return document.cookie.split('; ').some((c) => c === `${SETUP_NEXT_OFF_COOKIE}=1`)
}

/** How many tasks were done when the nudge last showed in this tab, per store (#102). */
const SHOWN_KEY = 'setup_next_shown_done'

function shownAt(scope: StorageScope | null): number | null {
  const key = scopedStorageKey(SHOWN_KEY, scope, { perUser: false })
  if (!key) return null
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw === null ? null : Number(raw)
  } catch {
    return null
  }
}

function rememberShown(scope: StorageScope | null, done: number) {
  const key = scopedStorageKey(SHOWN_KEY, scope, { perUser: false })
  if (!key) return
  try {
    window.sessionStorage.setItem(key, String(done))
  } catch {
    // Private mode: the nudge may show again, which is harmless.
  }
}

function turnPromptsOff() {
  // biome-ignore lint/suspicious/noDocumentCookie: a plain first-party preference cookie.
  document.cookie = `${SETUP_NEXT_OFF_COOKIE}=1; path=/; max-age=${ONE_YEAR}; samesite=lax`
}

/**
 * After a successful save on a page that belongs to a setup task, call the returned function
 * with that task. While setup is unfinished it shows one toast ("Store details saved · 3 of 7
 * set up. Next: Payments [Set up now]"), using the same next-task rule as the checklist. It
 * never shows once everything is done, after "Don't show again", or when the task just saved is
 * itself the only one left and still not done. Within one browser session it shows once, and
 * again only when a save finished another setup task, never after every save (#102).
 * Failures are swallowed: it is only a nudge.
 */
export function useSetupNext(): (task: SetupItemId) => Promise<void> {
  const router = useRouter()
  const storageScope = useStorageScope()
  const { checklist, next: copy } = useCopy(settingsHomeContent)

  return async (task) => {
    if (promptsOff()) return
    try {
      const progress = await api.store.setupChecklist({ after: task })
      const { next } = progress
      if (!next) return
      const saved = progress.items.find((i) => i.id === task)
      if (next === task && !saved?.done) return
      const last = shownAt(storageScope)
      if (last !== null && progress.done <= last) return
      rememberShown(storageScope, progress.done)
      const nextWords = checklist.items[next]
      toast(
        saved?.done
          ? copy.doneTitle(checklist.items[task].title, progress.done, progress.total)
          : copy.progressTitle(progress.done, progress.total),
        {
          description: copy.description(nextWords.title),
          action: { label: copy.setUp, onClick: () => router.push(nextWords.href) },
          cancel: { label: copy.dontShow, onClick: turnPromptsOff },
          duration: 12000,
          // Two buttons beside the words squeezed them into a narrow column: the words take the
          // full width and the buttons sit on their own row under them, on the right.
          classNames: {
            toast: 'flex-wrap! gap-y-3!',
            content: 'basis-full',
            cancelButton: 'ml-auto!',
          },
        },
      )
    } catch {
      // The save itself worked; skip the nudge.
    }
  }
}
