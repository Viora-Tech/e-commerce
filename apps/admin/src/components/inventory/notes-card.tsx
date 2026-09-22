'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Textarea } from '@commerce/ui/shadcn/textarea'

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
    <Card size="form">
      <CardHeader>
        <CardTitle>
          <label htmlFor={id}>{heading}</label>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          id={id}
          value={value}
          rows={3}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </CardContent>
    </Card>
  )
}
