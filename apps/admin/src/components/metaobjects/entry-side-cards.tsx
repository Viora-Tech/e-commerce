'use client'

import type { MetaobjectStatus } from '@commerce/core/metaobjects'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { entryFormContent } from '@/data/metaobjects'

type EntrySideCardsProps = {
  status: MetaobjectStatus
  handle: string
  onChange: (patch: { status?: MetaobjectStatus; handle?: string }) => void
}

const copy = entryFormContent
const STATUSES: MetaobjectStatus[] = ['active', 'draft']

/** Status and handle of an entry, in the side rail like a product's status card. */
export default function EntrySideCards({ status, handle, onChange }: EntrySideCardsProps) {
  // Render logic
  const items = { active: copy.status.active, draft: copy.status.draft }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{copy.status.heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <Field>
            <Select
              items={items}
              value={status}
              onValueChange={(v) => v !== null && onChange({ status: v as MetaobjectStatus })}
            >
              <SelectTrigger className="w-full" aria-label={copy.status.heading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {items[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{copy.status.help}</FieldDescription>
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.handle.heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <Field>
            <Input
              size="lg"
              value={handle}
              autoComplete="off"
              aria-label={copy.handle.heading}
              className="font-mono"
              onChange={(e) => onChange({ handle: e.target.value })}
            />
            <FieldDescription>{copy.handle.help}</FieldDescription>
          </Field>
        </CardContent>
      </Card>
    </>
  )
}
