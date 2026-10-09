import { ChevronRight } from '@commerce/ui/icons'
import Link from 'next/link'
import { SETTINGS_GROUPS, settingsHomeContent } from '@/data/settings'
import { localize } from '@/lib/copy'
import { getLocale } from '@/lib/copy-server'
import { pageBody, pageName } from '@/lib/page-names'
import { routes } from '@/lib/routes'
import SettingsPageHeader from './settings-page-header'
import SetupChecklistCard from './setup-checklist-card'

const LINK = 'text-foreground underline underline-offset-2 hover:text-ink-strong'

/** `/settings` (Proofly): the setup checklist, then a two-column grid of every settings page. */
export default async function SettingsHome() {
  // Render logic
  const locale = await getLocale()
  const copy = localize(settingsHomeContent, locale)
  const sections = SETTINGS_GROUPS.flatMap((g) => g.sections)

  return (
    <div className="flex flex-col gap-6">
      <SettingsPageHeader title={copy.title} subtitle={copy.intro} hideBack />
      <SetupChecklistCard />
      <h2 className="sr-only">{copy.all.heading}</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {sections.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group flex h-full flex-col gap-1 rounded-2xl bg-card p-5 shadow-card ring-1 ring-hairline transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-body font-semibold text-ink-strong">
                  {pageName(s.href, s.title, locale)}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                />
              </span>
              <span className="text-caption text-muted-foreground">
                {pageBody(s.href, s.body, locale)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {/* Pages that left Settings, so nobody hunts for them here. */}
      <div className="flex flex-col gap-1 px-1 text-caption text-muted-foreground">
        <p>
          {copy.elsewhere.personal}{' '}
          <Link href={routes.account.home()} className={LINK}>
            {copy.elsewhere.account}
          </Link>
          {' · '}
          <Link href={routes.account.appearance()} className={LINK}>
            {copy.elsewhere.appearance}
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
