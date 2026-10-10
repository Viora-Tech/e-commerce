import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { AppSummary } from './app-card'
import AppLogo from './app-logo'

type AppsRecommendedProps = {
  /** Already chosen by `recommendedApps`; the strip is hidden when empty. */
  apps: AppSummary[]
  storeName: string
  busyId: string | null
  onInstall: (app: AppSummary) => void
}

/** "Recommended for <store>" strip (Figma "Apps / Apps home"): apps for what the store lacks. */
export default function AppsRecommended({
  apps,
  storeName,
  busyId,
  onInstall,
}: AppsRecommendedProps) {
  // Hooks
  const copy = useCopy(appsContent)

  // Early returns
  if (apps.length === 0) return null

  // Render logic
  const recommended = copy.recommended

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-col">
        <h2 className="text-card-title text-ink-strong">{recommended.heading(storeName)}</h2>
        <p className="text-body text-muted-foreground">{recommended.intro}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {apps.map((app) => (
          <div
            key={app.id}
            className="relative flex h-full flex-col gap-3 rounded-2xl border border-border surface-card px-5 py-[1.125rem]"
          >
            <div className="flex items-center gap-3">
              <AppLogo id={app.id} icon={app.admin.icon} />
              <Link
                href={routes.apps.page(app.id)}
                className="min-w-0 flex-1 truncate text-[0.9375rem] leading-[1.375rem] font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {app.name}
              </Link>
            </div>
            <p className="rounded-lg bg-primary-soft px-3 py-2 text-body text-foreground">
              {recommended.reasons[app.id] ?? app.description}
            </p>
            <div className="mt-auto flex justify-end pt-1">
              <Button variant="outline" loading={busyId === app.id} onClick={() => onInstall(app)}>
                <Plus />
                {copy.install}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
