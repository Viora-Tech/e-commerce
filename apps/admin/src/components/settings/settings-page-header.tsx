import { ChevronLeftIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { SETTINGS_HOME, settingsContent } from '@/data/settings'

type SettingsPageHeaderProps = {
  title: string
  /** The plain-language line under the title. */
  subtitle?: string
  /** Save button: dimmed until `dirty`. Leave `onSave` out for pages that have no form. */
  onSave?: () => void
  dirty?: boolean
  saving?: boolean
  saveLabel?: string
  /** Extra buttons before Save. */
  actions?: ReactNode
  /** Hide the "‹ Settings" crumb (the Settings home itself). */
  hideBack?: boolean
  /** A parent page other than the Settings home (a detail page): where the crumb goes. */
  back?: { href: string; label: string }
  /** Status chips beside the title. */
  badges?: ReactNode
}

/**
 * Title block for every settings page (Proofly): "‹ Settings" crumb, big title, plain subtitle,
 * and the Save button on the right (dimmed until something changes).
 */
export default function SettingsPageHeader({
  title,
  subtitle,
  onSave,
  dirty = false,
  saving = false,
  saveLabel = settingsContent.general.save,
  actions,
  hideBack = false,
  back,
  badges,
}: SettingsPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {hideBack ? null : (
        <Link
          href={back?.href ?? SETTINGS_HOME.href}
          className={cn(
            '-ml-1 w-fit items-center gap-1 rounded-md pr-2 pl-1 text-nav text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4',
            back ? 'inline-flex' : 'hidden md:inline-flex',
          )}
        >
          <ChevronLeftIcon aria-hidden="true" />
          {back?.label ?? settingsContent.nav.back}
        </Link>
      )}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-page-title text-ink-strong">{title}</h1>
            {badges}
          </div>
          {subtitle ? (
            <p className="text-body font-normal text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions || onSave ? (
          <div className="flex items-center gap-2">
            {actions}
            {onSave ? (
              <Button type="button" onClick={onSave} disabled={!dirty} loading={saving}>
                {saveLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
