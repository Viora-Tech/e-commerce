import { ChevronRight, Settings } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import PageHeader from '@/components/layout/page-header'
import { SETTINGS_SECTIONS, settingsHomeContent } from '@/data/settings'
import { localize } from '@/lib/copy'
import { getLocale } from '@/lib/copy-server'
import { pageBody, pageName } from '@/lib/page-names'
import SetupChecklistCard from './setup-checklist-card'

/** `/settings`: the setup checklist first, then every settings page with a one-line summary. */
export default async function SettingsHome() {
  // Render logic
  const locale = await getLocale()
  const copy = localize(settingsHomeContent, locale)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.title} subtitle={copy.intro} icon={<Settings aria-hidden="true" />} />
      <SetupChecklistCard />
      <section className="flex flex-col gap-2" aria-labelledby="settings-all">
        <h2 id="settings-all" className="text-card font-semibold text-foreground">
          {copy.all.heading}
        </h2>
        <Card className="gap-0 py-0">
          <ul className="flex flex-col divide-y divide-border">
            {SETTINGS_SECTIONS.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:size-4">
                    <s.icon aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-body font-medium text-foreground">
                      {pageName(s.href, s.title, locale)}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {pageBody(s.href, s.body, locale)}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  )
}
