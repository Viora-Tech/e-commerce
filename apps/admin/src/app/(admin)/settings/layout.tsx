import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import SettingsNav from '@/components/settings/settings-nav'

type SettingsLayoutProps = { children: ReactNode }

/**
 * Settings area (Shopify-style, #147): the settings menu replaces the main sidebar
 * (`settings-sidebar-nav.tsx`), so the page is one narrow centred column. Every settings
 * page, the overview included, shares it, so no page sets its own max width.
 */
export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <PageBody className="mx-auto max-w-[52rem]">
      <SettingsNav />
      <div className="flex w-full min-w-0 flex-1 flex-col gap-6">{children}</div>
    </PageBody>
  )
}
