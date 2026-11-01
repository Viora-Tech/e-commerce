import { ChevronRight } from '@commerce/ui/icons'
import Link from 'next/link'
import PageHeader from '@/components/layout/page-header'
import { SETTINGS_GROUPS, settingsContent, settingsHomeContent } from '@/data/settings'
import { localize } from '@/lib/copy'
import { getLocale } from '@/lib/copy-server'
import { pageBody, pageName } from '@/lib/page-names'
import { routes } from '@/lib/routes'
import SetupChecklistCard from './setup-checklist-card'

const LINK = 'text-foreground underline underline-offset-2 hover:text-ink-strong'

/** `/settings`: the setup checklist, then every settings page as rows under its group. */
export default async function SettingsHome() {
  // Render logic
  const locale = await getLocale()
  const copy = localize(settingsHomeContent, locale)
  const { groups } = localize(settingsContent, locale)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={copy.title} subtitle={copy.intro} />
      <SetupChecklistCard />
      <h2 className="sr-only">{copy.all.heading}</h2>
      {/* Shopify-style (#147): each group is one card of rows, a › on every row. */}
      {SETTINGS_GROUPS.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`settings-home-${group.id}`}
          className="flex flex-col gap-2"
        >
          <h3
            id={`settings-home-${group.id}`}
            className="px-1 text-caption font-medium text-muted-foreground"
          >
            {groups[group.id]}
          </h3>
          <ul className="flex flex-col overflow-hidden rounded-xl surface-card">
            {group.sections.map((s) => (
              <li key={s.href} className="border-hairline border-b last:border-b-0">
                <Link
                  href={s.href}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                    <s.icon aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body font-medium text-ink-strong">
                      {pageName(s.href, s.title, locale)}
                    </span>
                    <span className="truncate text-caption text-muted-foreground">
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
        </section>
      ))}
      {/* Pages that left Settings, so nobody hunts for them here. */}
      <div className="flex flex-col gap-1 px-1 text-caption text-muted-foreground">
        <p>
          {copy.elsewhere.personal}{' '}
          <Link href={routes.account.home()} className={LINK}>
            {copy.elsewhere.account}
          </Link>{' '}
          {copy.elsewhere.personalWhere}
        </p>
        <p>
          {copy.elsewhere.storage}{' '}
          <Link href={routes.content.storage()} className={LINK}>
            {copy.elsewhere.storageLink}
          </Link>
        </p>
      </div>
    </div>
  )
}
