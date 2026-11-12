import { Switch } from '@commerce/ui/shadcn/switch'

type SwitchRowProps = {
  id: string
  label: string
  help: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** A setting on the variant page: its label and help on the left, the switch on the right. */
export default function SwitchRow({ id, label, help, checked, onChange }: SwitchRowProps) {
  // Render logic
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-body text-foreground">
          {label}
        </label>
        <p className="text-caption text-muted-foreground">{help}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
