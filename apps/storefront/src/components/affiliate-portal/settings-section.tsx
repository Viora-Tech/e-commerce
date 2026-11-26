import { Separator } from '@commerce/ui/shadcn/separator'
import type { ReactNode } from 'react'

type SettingsSectionProps = {
  title: string
  description?: string | undefined
  children: ReactNode
}

/**
 * One section of a Settings page as shadcn's forms example draws it: a heading and a muted line,
 * a separator, then the form itself on the page (no card around it).
 */
export default function SettingsSection({ title, description, children }: SettingsSectionProps) {
  // Render logic
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <Separator />
      {children}
    </section>
  )
}
