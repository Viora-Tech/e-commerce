import type { SettingsItem } from '@commerce/plugin-shopify-import/client'
import StatusChip from '@/components/layout/status-chip'
import { shopifyImportSettingsContent } from '@/data/shopify-import-settings'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { ACTION_VARIANT, itemText } from './settings-lines'

type SettingsItemRowProps = { item: SettingsItem }

/** One line of a part: what it is about, what happens to it, and the values or the reason. */
export default function SettingsItemRow({ item }: SettingsItemRowProps) {
  // Hooks
  const copy = useCopy(shopifyImportSettingsContent)
  const fmt = useFormat()

  // Render logic
  const { title, detail } = itemText(item, copy, fmt)

  return (
    <li className="flex items-start gap-3 py-2">
      <StatusChip tone={ACTION_VARIANT[item.action]} className="mt-0.5 shrink-0">
        {copy.actions[item.action]}
      </StatusChip>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="break-words font-medium text-ink-strong">{title}</span>
        {detail ? (
          <span className="break-words text-caption text-muted-foreground">{detail}</span>
        ) : null}
      </div>
    </li>
  )
}
