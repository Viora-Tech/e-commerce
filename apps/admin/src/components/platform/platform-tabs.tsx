import PillTabs from '@/components/layout/pill-tabs'

type PlatformTabsProps = {
  items: { label: string; href: string; active: boolean }[]
}

/** Underline tabs that are links (a list's state or source), for server-rendered console lists. */
export default function PlatformTabs({ items }: PlatformTabsProps) {
  // Render logic
  const active = items.find((item) => item.active)?.href ?? null

  return (
    <PillTabs
      className="no-scrollbar overflow-x-auto border-border border-b px-4"
      value={active}
      tabs={items.map((item) => ({ value: item.href, label: item.label, href: item.href }))}
    />
  )
}
