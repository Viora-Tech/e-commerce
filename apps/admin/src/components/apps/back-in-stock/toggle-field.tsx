import { Switch } from '@commerce/ui/shadcn/switch'

type ToggleFieldProps = {
  id: string
  label: string
  help: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** A label and its one-line help on the left, the switch on the right. */
export default function ToggleField({ id, label, help, checked, onChange }: ToggleFieldProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col">
        <label htmlFor={id} className="text-body font-medium text-ink-strong">
          {label}
        </label>
        <p className="text-caption text-muted-foreground">{help}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
