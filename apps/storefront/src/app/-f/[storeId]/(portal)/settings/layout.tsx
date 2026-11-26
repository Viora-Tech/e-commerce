import type { ReactNode } from 'react'
import SettingsNav from '@/components/affiliate-portal/settings-nav'
import { portalBase } from '@/lib/affiliate-portal'

type Props = { children: ReactNode }

/** Settings: Profile, Payout and tax, Notifications and Security, as tabs above each section. */
export default async function SettingsLayout({ children }: Props) {
  // Hooks
  const base = await portalBase()

  // Render logic
  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <SettingsNav base={base} />
      <div className="flex max-w-[42rem] flex-col gap-4">{children}</div>
    </div>
  )
}
