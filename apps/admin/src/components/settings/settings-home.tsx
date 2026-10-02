import { ChevronRight, Settings } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import PageHeader from '@/components/layout/page-header'
import { SETTINGS_GROUPS, settingsContent, settingsHomeContent } from '@/data/settings'
import { localize } from '@/lib/copy'
import { getLocale } from '@/lib/copy-server'
import { pageBody, pageName } from '@/lib/page-names'
import SetupChecklistCard from './setup-checklist-card'

const LINK = 'text-foreground underline underline-offset-2 hover:text-ink-strong'

/** `/settings`: the setup checklist first, then every settings page under its group heading. */
export default async function SettingsHome() {
  // Render logic
  const locale = await getLocale()
  const copy = localize(settingsHomeContent, locale)
  const { groups } = localize(settingsContent, locale)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.title} subtitle={copy.intro} icon={<Settings aria-hidden="true" />} />
      <SetupChecklistCard />
      <h2 className="sr-only">{copy.all.heading}</h2>
      {SETTINGS_GROUPS.map((group) => (
        <section
          key={group.id}
          className="flex flex-col gap-2"
          aria-labelledby={`settings-home-${group.id}`}
        >
          <h3 id={`settings-home-${group.id}`} className="text-eyebrow px-1">
            {groups[group.id]}
          </h3>
          <Card className="gap-0 py-0">
            <ul className="flex flex-col divide-y divide-border">
              {group.sections.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      ))}
      {/* Pages that left Settings, so nobody hunts for them here. */}
      <div className="flex flex-col gap-1 px-1 text-caption text-muted-foreground">
        <p>
          {copy.elsewhere.personal}{' '}
          <Link href="/account" className={LINK}>
            {copy.elsewhere.account}
          </Link>
          {' · '}
          <Link href="/account/appearance" className={LINK}>
            {copy.elsewhere.appearance}
          </Link>{' '}
          {copy.elsewhere.personalWhere}
        </p>
        <p>
          {copy.elsewhere.storage}{' '}
          <Link href="/content/files/storage" className={LINK}>
            {copy.elsewhere.storageLink}
          </Link>
        </p>
      </div>
    </div>
  )
}
