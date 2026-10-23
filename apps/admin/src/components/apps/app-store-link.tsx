'use client'

import { appStoreUrl } from '@commerce/config/site'
import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { ComponentProps, ReactNode } from 'react'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'

type AppStoreLinkProps = {
  /** Open one category of the App Store (`shipping`), or one app's page. */
  category?: string | undefined
  app?: string | undefined
  /** The button's words; "Browse the App Store" when left out. */
  children?: ReactNode
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  className?: string | undefined
}

/**
 * A button to the App Store website, where apps are browsed and installed (the admin keeps only
 * Installed apps). Opens a new tab so the admin stays where it was.
 */
export default function AppStoreLink({
  category,
  app,
  children,
  variant = 'outline',
  size,
  className,
}: AppStoreLinkProps) {
  // Hooks
  const copy = useCopy(appsContent)

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      nativeButton={false}
      render={<a href={appStoreUrl({ app, category })} target="_blank" rel="noopener noreferrer" />}
    >
      {children ?? copy.appStore.browse}
      <ExternalLink aria-hidden="true" />
      <span className="sr-only">{copy.appStore.newTab}</span>
    </Button>
  )
}
