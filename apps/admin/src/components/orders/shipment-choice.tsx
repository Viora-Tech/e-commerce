import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'

export type ShipmentChoice = { id: string; label: string }

type ShipmentChoiceProps = {
  choices: readonly ShipmentChoice[]
  value: string
  onChange: (id: string) => void
}

/**
 * Cancel shipment on an order with more than one live label: which one goes (owner, 22 Nov
 * 2026: "it should have asked me which one"). One row per label, "Delhivery · AWB …".
 */
export default function ShipmentChoicePicker({ choices, value, onChange }: ShipmentChoiceProps) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(String(v))} className="gap-2">
      {choices.map((c) => (
        <label
          key={c.id}
          htmlFor={`ship-${c.id}`}
          className="flex items-center gap-3 rounded-md border p-3 has-[[data-state=checked]]:border-primary"
        >
          <RadioGroupItem id={`ship-${c.id}`} value={c.id} />
          <span className="text-body">{c.label}</span>
        </label>
      ))}
    </RadioGroup>
  )
}
