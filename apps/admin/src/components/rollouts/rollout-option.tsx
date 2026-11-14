import { Field, FieldContent, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
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
    <Field orientation="horizontal" className="items-start gap-2">
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <FieldContent className="gap-0">
        <FieldLabel htmlFor={id} className="text-body leading-5 font-normal">
          {label}
        </FieldLabel>
        <FieldDescription>{help}</FieldDescription>
      </FieldContent>
    </Field>
  )
}
