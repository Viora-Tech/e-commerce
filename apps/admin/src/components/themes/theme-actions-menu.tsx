'use client'

import {
  Braces,
  Copy,
  Download,
  History,
  type IconComponent,
  Palette,
  Pencil,
  Trash2,
} from '@commerce/ui/icons'
import ActionMenu from '@/components/layout/action-menu'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'

export type ThemeAction = 'rename' | 'duplicate' | 'versions' | 'download' | 'delete'

const ACTION_ICONS: Record<Exclude<ThemeAction, 'delete'>, IconComponent> = {
  rename: Pencil,
  duplicate: Copy,
  versions: History,
  download: Download,
}

type ThemeActionsMenuProps = {
  actions: readonly ThemeAction[]
  /** Customize as the menu's first item (Figma "menu open"), for cards whose button is off-screen. */
  customizeHref?: string
  /** Edit code, after Customize (Figma 699:93894: Themes › ⋯ › Edit code). */
  codeHref?: string
  /** The live theme card's kebab is a key button beside Customize (Figma); rows keep the rim. */
  variant?: 'default' | 'outline' | 'plain'
  disabled?: boolean
  onAction: (action: ThemeAction) => void
}

/** The kebab on a theme card: customize, duplicate, rename, versions, download settings, delete. */
export default function ThemeActionsMenu({
  actions,
  customizeHref,
  codeHref,
  variant = 'outline',
  disabled,
  onAction,
}: ThemeActionsMenuProps) {
  // Hooks
  const labels = useCopy(themesContent.library)

  // Render logic
  const safe = actions.filter((a): a is Exclude<ThemeAction, 'delete'> => a !== 'delete')
  const canDelete = actions.includes('delete')

  return (
    <ActionMenu
      label={labels.actions}
      variant={variant}
      size="md"
      align="start"
      disabled={disabled}
      items={[
        { label: labels.customize, icon: Palette, href: customizeHref, hidden: !customizeHref },
        { label: labels.editCode, icon: Braces, href: codeHref, hidden: !codeHref },
        ...safe.map((a) => ({
          label: labels[a],
          icon: ACTION_ICONS[a],
          onSelect: () => onAction(a),
        })),
        {
          label: labels.delete,
          icon: Trash2,
          destructive: true,
          hidden: !canDelete,
          onSelect: () => onAction('delete'),
        },
      ]}
    />
  )
}
