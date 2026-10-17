'use client'

import ActionMenu from '@/components/layout/action-menu'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'

export type ThemeAction = 'rename' | 'duplicate' | 'versions' | 'download' | 'delete'

type ThemeActionsMenuProps = {
  actions: readonly ThemeAction[]
  /** Customize as the menu's first item (Figma "menu open"), for cards whose button is off-screen. */
  customizeHref?: string
  /** The live theme card's kebab is a key button beside Customize (Figma); rows keep the rim. */
  variant?: 'default' | 'outline' | 'plain'
  disabled?: boolean
  onAction: (action: ThemeAction) => void
}

/** The kebab on a theme card: customize, duplicate, rename, versions, download settings, delete. */
export default function ThemeActionsMenu({
  actions,
  customizeHref,
  variant = 'outline',
  disabled,
  onAction,
}: ThemeActionsMenuProps) {
  // Hooks
  const labels = useCopy(themesContent.library)

  // Render logic
  const safe = actions.filter((a) => a !== 'delete')
  const canDelete = actions.includes('delete')

  return (
    <ActionMenu
      label={labels.actions}
      variant={variant}
      size="md"
      align="start"
      disabled={disabled}
      items={[
        { label: labels.customize, href: customizeHref, hidden: !customizeHref },
        ...safe.map((a) => ({ label: labels[a], onSelect: () => onAction(a) })),
        {
          label: labels.delete,
          destructive: true,
          hidden: !canDelete,
          onSelect: () => onAction('delete'),
        },
      ]}
    />
  )
}
