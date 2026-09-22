'use client'

import {
  COLLECTION_SORTS,
  type CollectionSort,
  type CollectionStatus,
} from '@commerce/core/collections'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { collectionFormContent as copy, SORT_LABELS } from '@/data/collections'

type CollectionStatusCardProps = {
  status: CollectionStatus
  onChange: (status: CollectionStatus) => void
  sortOrder: CollectionSort
  onSortChange: (sort: CollectionSort) => void
}

const STATUS_LABELS: Record<CollectionStatus, string> = {
  active: copy.status.active,
  draft: copy.status.draft,
}

export default function CollectionStatusCard({
  status,
  onChange,
  sortOrder,
  onSortChange,
}: CollectionStatusCardProps) {
  // Render logic
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.status.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor="collection-status">{copy.status.heading}</FieldLabel>
          <Select value={status} onValueChange={(s) => onChange(String(s) as CollectionStatus)}>
            <SelectTrigger id="collection-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['active', 'draft'] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{copy.status.help}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="collection-sort">{copy.sort.heading}</FieldLabel>
          <Select
            value={sortOrder}
            onValueChange={(s) => onSortChange(String(s) as CollectionSort)}
          >
            <SelectTrigger id="collection-sort" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLLECTION_SORTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {SORT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{copy.sort.help}</FieldDescription>
        </Field>
      </CardContent>
    </Card>
  )
}
