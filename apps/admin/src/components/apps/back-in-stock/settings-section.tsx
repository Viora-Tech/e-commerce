import type { ReactNode } from 'react'

type SettingsSectionProps = {
  title: string
  help: string
  children: ReactNode
}

/**
 * One section of the Back in stock settings (Figma 928:12095): the title and its help on the
 * left, the card with the controls on the right, a divider above every section but the first.
 * Stacks on phones. Local to this app on purpose; the shared settings cards stay as they are.
 */
export default function SettingsSection({ title, help, children }: SettingsSectionProps) {
  return (
    <section className="grid gap-3 border-hairline border-t py-5 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-8">
      <div className="flex min-w-0 flex-col gap-0.5 md:pt-2.5">
        <h3 className="text-body font-semibold text-ink-strong">{title}</h3>
        <p className="text-caption text-muted-foreground">{help}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4 rounded-xl surface-card p-4">{children}</div>
    </section>
  )
}
