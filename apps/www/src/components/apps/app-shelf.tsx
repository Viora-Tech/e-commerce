import type { CatalogueApp } from '@commerce/core/app-catalogue'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import { appPath } from '@/data/apps'
import AppTile from './app-tile'

type AppShelfProps = { apps: CatalogueApp[] }

const COLUMNS = 6

/** Deals the apps into columns so the wall reads left to right, row by row. */
function deal(apps: CatalogueApp[]): CatalogueApp[][] {
  const columns: CatalogueApp[][] = Array.from({ length: COLUMNS }, () => [])
  for (const [i, app] of apps.entries()) columns[i % COLUMNS]?.push(app)
  return columns
}

/**
 * The hero's wall of every app icon, alternate columns dropped half a tile, fading out at the
 * edges. A shortcut for the mouse; the same apps are listed in full below, so the wall is
 * hidden from screen readers and skipped by Tab.
 */
export default function AppShelf({ apps }: AppShelfProps) {
  return (
    <div aria-hidden className="relative hidden select-none lg:block">
      <div className="flex justify-center gap-3 mask-[radial-gradient(ellipse_70%_75%_at_50%_50%,#000_45%,transparent_100%)] py-6">
        {deal(apps).map((column, c) => (
          <div
            key={column[0]?.id ?? c}
            className={cn('flex flex-col gap-3', c % 2 === 1 && 'translate-y-8')}
          >
            {column.map((app) => (
              <Link
                key={app.id}
                href={appPath(app.id)}
                tabIndex={-1}
                title={app.name}
                className="rounded-[1.125rem] transition-[scale,opacity] duration-(--duration-popover) ease-out hover:scale-[1.08] motion-reduce:hover:scale-100"
              >
                <AppTile
                  id={app.id}
                  name={app.name}
                  icon={app.icon}
                  ours={app.kind === 'builtin'}
                  size="lg"
                />
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
