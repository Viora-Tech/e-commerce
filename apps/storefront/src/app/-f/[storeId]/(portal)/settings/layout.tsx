import { Separator } from '@commerce/ui/shadcn/separator'
import type { ReactNode } from 'react'
import SettingsNav from '@/components/affiliate-portal/settings-nav'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { portalBase } from '@/lib/affiliate-portal'

type Props = { children: ReactNode }

/**
 * Settings after shadcn's forms example (the title is in the SiteHeader): one line and a
 * separator, then the sections down the left (a fifth of the width; a row on a phone) and the
 * open one beside them, at most 42rem wide.
 */
export default async function SettingsLayout({ children }: Props) {
  // Hooks
  const base = await portalBase()

  // Render logic
  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <p className="text-sm text-muted-foreground">{affiliatePortalContent.settings.help}</p>
      <Separator />
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <SettingsNav base={base} />
        <div className="flex min-w-0 flex-1 flex-col gap-10 lg:max-w-2xl">{children}</div>
      </div>
    </div>
  )
}
