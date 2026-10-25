'use client'

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from '@commerce/ui/shadcn/combobox'

/** One labelled block of choices, e.g. "Suppliers" then "Used on products". */
export type ComboGroup = { label: string; items: string[] }

type ComboInputProps = {
  id?: string | undefined
  value: string
  onChange: (value: string) => void
  groups: ComboGroup[]
  placeholder?: string | undefined
}

/**
 * Free text with a grouped dropdown of known values. Picking fills the field; typing something
 * new keeps it, so the list helps without forcing a choice (vendors are an open vocabulary).
 */
export default function ComboInput({ id, value, onChange, groups, placeholder }: ComboInputProps) {
  // Render logic
  const items = groups
    .filter((g) => g.items.length > 0)
    .map((g) => ({ value: g.label, items: g.items }))

  return (
    <Combobox
      items={items}
      inputValue={value}
      onInputValueChange={(next, details) => {
        // Only typing and picking change the value; closing the list must not reset it.
        if (details.reason === 'input-change' || details.reason === 'item-press') onChange(next)
      }}
      onValueChange={(next) => typeof next === 'string' && onChange(next)}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        autoComplete="off"
        className="h-9 w-full bg-input-surface"
      />
      <ComboboxContent>
        <ComboboxList>
          {(group: { value: string; items: string[] }) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel>{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
