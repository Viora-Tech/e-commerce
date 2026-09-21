import { Card } from '@commerce/ui/shadcn/card'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import PageBody from '@/components/layout/page-body'
import { SETTINGS_SECTIONS, type SettingsSection } from '@/data/settings'

type SettingsTileProps = { section: SettingsSection }

function SettingsTile({ section }: SettingsTileProps) {
  return (
    <Link
      href={section.href}
      className="group rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="flex h-full flex-row items-start gap-4 p-6 transition-colors group-hover:border-primary/40">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <section.icon className="size-5" strokeWidth={1.8} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-card-title">{section.title}</span>
          <span className="text-body text-muted-foreground">{section.body}</span>
        </span>
        <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground-soft transition-transform group-hover:translate-x-0.5" />
      </Card>
    </Link>
  )
}

/** Settings index: one tile per section, Shopify's order. */
export default function SettingsGrid() {
  return (
    <PageBody>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SETTINGS_SECTIONS.map((s) => (
          <SettingsTile key={s.href} section={s} />
        ))}
      </div>
    </PageBody>
  )
}
