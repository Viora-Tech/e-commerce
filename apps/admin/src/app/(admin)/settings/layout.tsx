import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import SettingsNav from '@/components/settings/settings-nav'

type SettingsLayoutProps = { children: ReactNode }

/**
 * Settings area (Proofly): the settings nav sits in the panel on the left, the active page on
 * the right. Every settings page, the overview included, shares this one content column, so no
 * page sets its own max width.
 */
export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <PageBody className="max-w-[96rem] md:mx-auto md:flex-row md:items-start md:gap-8">
      <SettingsNav />
      <div className="flex w-full min-w-0 max-w-[77.5rem] flex-1 flex-col gap-6">{children}</div>
    </PageBody>
  )
}
