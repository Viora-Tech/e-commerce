import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import SettingsNav from '@/components/settings/settings-nav'
import SettingsSidebarNav from '@/components/settings/settings-sidebar-nav'

type SettingsLayoutProps = { children: ReactNode }

/**
 * Settings area: the main sidebar stays as it is, and the settings menu is a column on the left
 * of the page with the active page beside it (owner 2026-10-31: both menus side by side, as the
 * live admin had it). Every settings page shares the one content column, so no page sets its own
 * width. Phones get `SettingsNav` instead: search on the home list, a back link elsewhere.
 */
export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <PageBody className="mx-auto max-w-[68rem] md:flex-row md:items-start md:gap-8">
      <SettingsNav />
      <aside className="sticky top-0 hidden w-60 shrink-0 md:block">
        <SettingsSidebarNav />
      </aside>
      <div className="flex w-full min-w-0 flex-1 flex-col gap-6">{children}</div>
    </PageBody>
  )
}
