import { cn } from '@commerce/ui/lib/utils'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import {
  HERO_CHART,
  HERO_CHART_ROW,
  HERO_FOOTER,
  HERO_PILL_HEIGHT,
  HERO_SHELL,
  HERO_TILES_ROW,
  HERO_TOOLBAR,
  HOME_NARROW,
  HOME_RHYTHM,
  HOME_SECTION,
  HOME_SPLIT,
  LATEST_ROWS,
  LIVE_GLOBE,
  ORDER_ROW,
  SUGGEST_CARD_HEIGHT,
  SUGGEST_GRID,
  TILE_BOX,
  TILE_GRID,
  TODO_GRID,
  TODO_TILE,
} from '@/components/home/home-layout'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'

const STILL = 'motion-reduce:animate-none'

/**
 * Home's loading shape, drawn from Home's own layout classes (`home/home-layout.ts`): the
 * 68rem page with its 2.5rem rhythm, the 48rem greeting and Ask AI column, the sales hero on
 * its real toolbar, tile and chart boxes, Store health, To do, Latest orders beside Live now on
 * the 640:424 split, Suggested for you and the closed More numbers row. Finish setup is left
 * out: it shows only while a set-up step is open, and a reserved row would jump away for every
 * store that finished.
 */
export default function DashboardSkeleton() {
  // Render logic
  return (
    <PageBody width="settings" className={HOME_RHYTHM} aria-hidden="true">
      <div className={HOME_NARROW}>
        {/* Greeting: the page title and one sentence, the date on the right. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Line box="h-9" bar="h-7 w-64 max-w-full" />
            <Line box="h-5" bar="h-3.5 w-96 max-w-full" />
          </div>
          <Line box="h-4.5 mt-1.5" bar="h-3 w-20" />
        </div>
        {/* Ask AI: the 3.75rem box and three example questions. */}
        <div className="flex flex-col gap-3">
          <Skeleton className={cn('h-15 w-full rounded-lg', STILL)} />
          <div className="flex flex-wrap gap-2">
            {['w-44', 'w-52', 'w-40'].map((w) => (
              <Skeleton key={w} className={cn('h-[2.0625rem] rounded-full', w, STILL)} />
            ))}
          </div>
        </div>
      </div>
      <section className={HERO_SHELL}>
        <div className={HERO_TOOLBAR}>
          {['w-32', 'w-36', 'w-28'].map((w) => (
            <Skeleton key={w} className={cn(HERO_PILL_HEIGHT, 'rounded-full', w, STILL)} />
          ))}
          <span className="flex-1" />
          <Skeleton className={cn(HERO_PILL_HEIGHT, 'w-24', STILL)} />
        </div>
        <div className={HERO_TILES_ROW}>
          <div className={TILE_GRID}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i.toString()} className={cn(TILE_BOX, 'border-transparent')}>
                <Line box="h-5" bar="h-3 w-20" />
                <Line box="h-[1.8125rem]" bar="h-6 w-24" />
                <Line box="h-4" bar="h-2.5 w-28" />
              </div>
            ))}
          </div>
        </div>
        <div className={HERO_CHART_ROW}>
          <Skeleton className={cn(HERO_CHART, STILL)} />
        </div>
        <div className={HERO_FOOTER}>
          <Line box="h-5" bar="h-3 w-48" />
          <Line box="h-5" bar="h-3 w-20" />
        </div>
      </section>
      {/* Store health: title, the Open button, the severity chips and the worst problem. */}
      <DataCard
        title={<Line box="h-6" bar="h-4 w-28" />}
        action={<Skeleton className={cn('h-8 w-20', STILL)} />}
        bodyClassName="flex flex-col gap-1.5"
      >
        <Line box="h-5.5" bar="h-5 w-40" />
        <Line box="h-4.5" bar="h-3 w-2/3" />
      </DataCard>
      <section className={HOME_SECTION}>
        <Head aside="h-8 w-28" />
        <div className={TODO_GRID}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i.toString()} className={TODO_TILE}>
              <Skeleton className={cn('size-10 rounded-lg', STILL)} />
              <div className="flex w-full flex-col gap-1">
                <Line box="h-6" bar="h-4 w-32" />
                <Line box="h-[1.1875rem]" bar="h-3 w-full" />
                <Line box="h-[1.1875rem]" bar="h-3 w-2/3" />
              </div>
              <Skeleton className={cn('mt-auto h-9 w-24 self-end', STILL)} />
            </div>
          ))}
        </div>
      </section>
      <div className={HOME_SPLIT}>
        <DataCard
          title={<Line box="h-6" bar="h-4 w-32" />}
          action={<Line box="h-5" bar="h-3 w-14" />}
          flush
          className="min-w-0 pb-0"
        >
          <div className="flex flex-col divide-y divide-border">
            {Array.from({ length: LATEST_ROWS }, (_, i) => (
              <div key={i.toString()} className={ORDER_ROW}>
                <Skeleton className={cn('size-8 shrink-0 rounded-full', STILL)} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Line box="h-5" bar="h-3.5 w-36" />
                  <Line box="h-[1.1875rem]" bar="h-3 w-24" />
                </div>
                <span className="flex w-28 shrink-0 justify-center">
                  <Skeleton className={cn('h-5 w-16 rounded-full', STILL)} />
                </span>
                <span className="flex w-[5.625rem] shrink-0 justify-end">
                  <Skeleton className={cn('h-3.5 w-16', STILL)} />
                </span>
              </div>
            ))}
          </div>
        </DataCard>
        <DataCard
          title={<Line box="h-6" bar="h-4 w-24" />}
          className="min-w-0"
          bodyClassName="flex flex-1 flex-col"
        >
          <div className="flex flex-col gap-0.5">
            <Line box="h-[2.875rem]" bar="h-9 w-20" />
            <Line box="h-[1.1875rem]" bar="h-3 w-40" />
            <Line box="h-[1.1875rem]" bar="h-3 w-48" />
          </div>
          <div className={cn('-mx-5 mt-auto -mb-5', LIVE_GLOBE)} />
        </DataCard>
      </div>
      <section className={HOME_SECTION}>
        <Head />
        <div className={SUGGEST_GRID}>
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton
              key={i.toString()}
              className={cn(SUGGEST_CARD_HEIGHT, 'w-full rounded-lg', STILL)}
            />
          ))}
        </div>
      </section>
      {/* More numbers, closed: its title and one grey line. */}
      <div className="flex flex-col p-1">
        <Line box="h-6" bar="h-4 w-32" />
        <Line box="h-[1.1875rem]" bar="h-3 w-64 max-w-full" />
      </div>
    </PageBody>
  )
}

/** A bar centred in a line box of the real text's height, so the box keeps that height. */
function Line({ box, bar }: { box: string; bar: string }) {
  return (
    <span className={cn('flex items-center', box)}>
      <Skeleton className={cn(bar, STILL)} />
    </span>
  )
}

/** A section heading row (SectionHead): the card-title line and, on the right, a small control. */
function Head({ aside = 'h-5 w-24' }: { aside?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Line box="h-6" bar="h-4 w-36" />
      <Skeleton className={cn(aside, STILL)} />
    </div>
  )
}
