import { Separator } from '@commerce/ui/shadcn/separator'
import type { ReactNode } from 'react'
import SettingsNav from '@/components/affiliate-portal/settings-nav'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { portalBase } from '@/lib/affiliate-portal'

type Props = { children: ReactNode }

/**
 * Settings after shadcn's forms example (the title is in the SiteHeader): one line, then the sections down the left
 * (Profile, Payout and tax, Notifications, Security) and the open one beside them.
 */
export default async function SettingsLayout({ children }: Props) {
  // Hooks
  const base = await portalBase()

  // Render logic
  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <p className="text-sm text-muted-foreground">{affiliatePortalContent.settings.help}</p>
      <Separator />
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <SettingsNav base={base} />
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:max-w-[42rem]">{children}</div>
      </div>
    </div>
  )
}
