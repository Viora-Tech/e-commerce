import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import SettingsNav from '@/components/settings/settings-nav'

type SettingsLayoutProps = { children: ReactNode }

/**
 * Settings area: vertical tabs on the left, the active section on the right. Every settings
 * page, the overview included, shares this one content column (56rem, centred in the space
 * beside the tabs), so no page sets its own max width.
 */
export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <PageBody className="md:flex-row md:items-start md:gap-6">
      <SettingsNav />
      <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-1 flex-col gap-4">{children}</div>
    </PageBody>
  )
}
