'use client'

import { Textarea } from '@commerce/ui/shadcn/textarea'
import DataCard from '@/components/layout/data-card'

type NotesCardProps = {
  id: string
  heading: string
  placeholder: string
  value: string
  disabled: boolean
  onChange: (note: string) => void
}

/** Free-text note on a purchase order or transfer. */
export default function NotesCard({
  id,
  heading,
  placeholder,
  value,
  disabled,
  onChange,
}: NotesCardProps) {
  return (
    <DataCard title={<label htmlFor={id}>{heading}</label>}>
      <Textarea
        id={id}
        value={value}
        rows={3}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </DataCard>
  )
}
