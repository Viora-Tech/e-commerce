import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import SettingsNav from '@/components/settings/settings-nav'

type SettingsLayoutProps = { children: ReactNode }

/** Settings area: vertical tabs on the left, the active section's form on the right. */
export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <PageBody className="md:flex-row md:items-start md:gap-6">
      <SettingsNav />
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
    </PageBody>
  )
}
