'use client'

import { ArrowLeft, WifiOff } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { EDITOR_HELP_URL } from './customize-rail'

type EditorLoadingProps = {
  storeName: string
  /** `failed`: the page could not be loaded in time, or at all. */
  state: 'loading' | 'failed'
  onRetry: () => void
}

/** The skeleton canvas: four product cards under the hero. */
const CARDS = [0, 1, 2, 3]

/**
 * The editor while its first page loads (Proofly look): the editor's own frame drawn as
 * placeholders (top bar, rail, panel) around a skeleton page with a header, a hero and a product
 * row, under a soft shimmer (still under reduced motion), with the store's name. When the page
 * cannot be loaded it says so, with Try again and help.
 */
export default function EditorLoading({ storeName, state, onRetry }: EditorLoadingProps) {
  // Hooks
  const copy = useCopy(customizeContent.loading)
  const reducedMotion = useReducedMotion()

  // Render logic
  const failed = state === 'failed'
  const still = reducedMotion === true || failed

  return (
    <div data-editor-chrome="" className="flex h-svh flex-col bg-sidebar" aria-busy={!failed}>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <Bone still={still} className="h-9 w-24 rounded-[0.625rem]" />
        <Bone still={still} className="h-5 w-28" />
        <div className="flex flex-1 justify-center">
          <Bone still={still} className="h-[2.375rem] w-60 rounded-[0.625rem]" />
        </div>
        <Bone still={still} className="h-9 w-28 rounded-[0.625rem]" />
        <Bone still={still} className="h-9 w-20 rounded-[0.625rem]" />
        <Bone still={still} className="size-8 rounded-full" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-16 shrink-0 flex-col items-center gap-3 border-r border-border bg-card py-4">
          <Bone still={still} className="size-8 rounded-[0.5625rem]" />
        </div>
        <div className="hidden w-[19rem] shrink-0 flex-col gap-4 border-r border-border bg-card p-4 md:flex">
          <div className="flex flex-col gap-1.5 border-b border-border pb-3">
            <p className="truncate text-sm leading-5 font-semibold text-foreground">{storeName}</p>
            <Bone still={still} className="h-3 w-24" />
          </div>
          <Bone still={still} className="h-[2.375rem] w-full rounded-lg" />
          <Bone still={still} className="h-10 w-full rounded-[0.625rem]" />
          <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
            {CARDS.map((i) => (
              <Bone key={i} still={still} className="h-[5.5rem] rounded-[0.625rem]" />
            ))}
          </div>
        </div>
        <main className="relative flex min-w-0 flex-1 justify-center bg-muted px-6 pt-8">
          <div className="flex h-full w-full max-w-[72rem] flex-col overflow-hidden rounded-t-[0.625rem] bg-card shadow-popover">
            <div className="h-7 bg-foreground/80" />
            <div className="flex items-center gap-6 px-8 py-4">
              <Bone still={still} className="h-5 w-24" />
              <div className="flex-1" />
              {CARDS.map((i) => (
                <Bone key={i} still={still} className="hidden h-3 w-16 sm:block" />
              ))}
            </div>
            <div className="flex h-64 flex-col justify-center gap-3 bg-muted/60 px-14">
              <Bone still={still} className="h-9 w-2/5" />
              <Bone still={still} className="h-4 w-1/2" />
              <Bone still={still} className="mt-2 h-10 w-36 rounded-lg" />
            </div>
            <div className="flex flex-col gap-4 px-8 py-8">
              <Bone still={still} className="h-6 w-32" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {CARDS.map((i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Bone still={still} className="aspect-[3/2] rounded-lg" />
                    <Bone still={still} className="h-3.5 w-3/4" />
                    <Bone still={still} className="h-3.5 w-1/3" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {failed ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 p-6 backdrop-blur-[2px]">
              <div
                role="alert"
                className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center shadow-popover"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger">
                  <WifiOff aria-hidden className="size-5" />
                </span>
                <h1 className="text-base leading-6 font-semibold text-foreground">
                  {copy.failedTitle}
                </h1>
                <p className="text-sm text-muted-foreground">{copy.failedBody}</p>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  <Button onClick={onRetry}>{copy.retry}</Button>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<a href={EDITOR_HELP_URL} target="_blank" rel="noreferrer" />}
                  >
                    {copy.help}
                  </Button>
                </div>
                <Link
                  href={routes.onlineStore.themes()}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft aria-hidden className="size-3.5" />
                  {copy.back}
                </Link>
              </div>
            </div>
          ) : (
            <p
              role="status"
              className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-card"
            >
              {copy.message(storeName)}
            </p>
          )}
        </main>
      </div>
    </div>
  )
}

/** One placeholder shape, with a soft light sweeping across it unless `still`. */
function Bone({ className, still }: { className?: string; still: boolean }) {
  // Render logic
  return (
    <span
      aria-hidden
      className={cn('relative block overflow-hidden rounded-md bg-muted', className)}
    >
      {still ? null : (
        <motion.span
          className="absolute inset-0 bg-gradient-to-r from-transparent via-card/80 to-transparent dark:via-foreground/[0.06]"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.4, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
        />
      )}
    </span>
  )
}
