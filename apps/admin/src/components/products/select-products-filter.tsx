import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'

type SelectProductsFilterProps = {
  label: string
  value: string
  items: Record<string, string>
  onChange: (value: string) => void
}

/** One dropdown filter in the picker; the first item is "any". */
export default function SelectProductsFilter({
  label,
  value,
  items,
  onChange,
}: SelectProductsFilterProps) {
  // Render logic
  return (
    <Select items={items} value={value} onValueChange={(next) => onChange(String(next))}>
      <SelectTrigger aria-label={label} className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([key, text]) => (
          <SelectItem key={key} value={key}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
