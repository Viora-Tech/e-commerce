import type { CatalogueApp } from '@commerce/core/app-catalogue'
import Link from 'next/link'
import { appPath, byline, priceChip } from '@/data/apps'
import AppTile from './app-tile'

type AppCardProps = { app: CatalogueApp }

/** One app in the directory: logo, name, maker, one line and its price, linking to its page. */
export default function AppCard({ app }: AppCardProps) {
  return (
    <Link
      href={appPath(app.id)}
      className="surface-card spotlight flex h-full flex-col gap-3 rounded-2xl p-5 outline-none transition-[scale] duration-(--duration-press) ease-out focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-(--motion-press-scale)"
    >
      <span className="flex items-center gap-3">
        <AppTile id={app.id} name={app.name} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-foreground">{app.name}</span>
          <span className="truncate text-xs text-muted-foreground">{byline(app)}</span>
        </span>
      </span>
      <span className="text-sm text-muted-foreground">{app.tagline}</span>
      <span className="mt-auto text-xs font-medium text-foreground">{priceChip(app.price)}</span>
    </Link>
  )
}
