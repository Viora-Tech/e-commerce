'use client'

import { Textarea } from '@commerce/ui/shadcn/textarea'
import DataCard from '@/components/layout/data-card'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'

type NoteCardProps = {
  value: string
  onChange: (value: string) => void
}

/** One internal note per customer; the page's save bar saves it with the other edits. */
export default function CustomerNoteCard({ value, onChange }: NoteCardProps) {
  // Hooks
  const detail = useCopy(customerDetailContent)

  return (
    <DataCard title={detail.note.heading} className="rounded-xl">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={detail.note.placeholder}
        rows={3}
        aria-label={detail.note.heading}
      />
    </DataCard>
  )
}
