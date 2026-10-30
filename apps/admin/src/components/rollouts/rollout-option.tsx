import { RadioGroupItem } from '@commerce/ui/shadcn/radio-group'

type RolloutOptionProps = {
  id: string
  value: string
  label: string
  help: string
}

/** One radio choice with a line of help under its label. */
export default function RolloutOption({ id, value, label, help }: RolloutOptionProps) {
  return (
    <label htmlFor={id} className="flex items-start gap-2">
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="flex flex-col">
        <span className="text-body">{label}</span>
        <span className="text-caption text-muted-foreground">{help}</span>
      </span>
    </label>
  )
}
