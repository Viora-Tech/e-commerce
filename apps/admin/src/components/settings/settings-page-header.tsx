import { ChevronLeftIcon } from '@commerce/ui/icons'
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
}: SettingsPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {hideBack ? null : (
        <Link
          href={SETTINGS_HOME.href}
          className="-ml-1 hidden w-fit items-center gap-1 rounded-md pr-2 pl-1 text-nav text-muted-foreground transition-colors hover:text-foreground md:inline-flex [&_svg]:size-4"
        >
          <ChevronLeftIcon aria-hidden="true" />
          {settingsContent.nav.back}
        </Link>
      )}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-1">
          <h1 className="text-page-title text-ink-strong">{title}</h1>
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
