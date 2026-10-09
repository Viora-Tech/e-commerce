import { Checkbox } from '@commerce/ui/shadcn/checkbox'

type SelectProductsCheckboxProps = {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}

/* A dash instead of the tick when only some of a product's variants are picked. */
const INDETERMINATE =
  'border-primary bg-primary! text-primary-foreground before:h-0.5 before:w-2 before:rounded-full before:bg-primary-foreground [&_svg]:hidden'

export default function SelectProductsCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  label,
  onChange,
}: SelectProductsCheckboxProps) {
  // Render logic
  return (
    <Checkbox
      aria-label={label}
      checked={checked}
      indeterminate={indeterminate}
      disabled={disabled}
      onCheckedChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className={indeterminate ? INDETERMINATE : undefined}
    />
  )
}
