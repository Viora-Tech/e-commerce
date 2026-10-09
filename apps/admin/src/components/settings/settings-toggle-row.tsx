import { cn } from '@commerce/ui/lib/utils'
import { Switch } from '@commerce/ui/shadcn/switch'
import type { ReactNode } from 'react'

type SettingsToggleRowProps = {
  id: string
  label: string
  description?: string | undefined
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  /** Extra content under the label (a link, a note). */
  children?: ReactNode
  className?: string
}

/** A settings row with an on/off switch on the right (Proofly): label and help on the left. */
export default function SettingsToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
  children,
  className,
}: SettingsToggleRowProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-6 border-b border-hairline py-5 first:pt-0 last:border-b-0 last:pb-0',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="text-body font-semibold text-ink-strong">
          {label}
        </label>
        {description ? (
          <p className="text-caption font-normal text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
        disabled={disabled}
        className="mt-0.5"
      />
    </div>
  )
}
