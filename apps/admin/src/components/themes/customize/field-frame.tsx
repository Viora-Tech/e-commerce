import type { IconComponent } from '@commerce/ui/icons'
import type { ReactNode } from 'react'

type FieldFrameProps = {
  icon: IconComponent
  label: string
  children: ReactNode
}

/**
 * The icon + label row every field-type override in Customize's right panel
 * shares, with the actual control below it. Puck's own `fieldLabel` can't tell
 * one field type from another (it only gets the label text), so the panel
 * suppresses it entirely (`fieldLabel: () => <></>`) and every `fieldTypes`
 * override renders its label through this instead — the one place that knows
 * both the icon and the text.
 */
export default function FieldFrame({ icon: Icon, label, children }: FieldFrameProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
        <Icon aria-hidden weight="light" className="size-4 shrink-0" />
        {label}
      </span>
      {children}
    </div>
  )
}
