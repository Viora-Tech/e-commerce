'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import Link from 'next/link'
import { onlineStoreContent } from '@/data/online-store'
import { useCopy } from '@/hooks/use-copy'

type PageTemplateCardProps = {
  /** Page alternates of the live theme (`page.<suffix>`). */
  suffixes: string[]
  value: string
  /** Customize on this page's template. */
  contentHref: string
  onChange: (suffix: string) => void
}

const DEFAULT = '__default'

/** Which theme template lays the page out, and the way into Customize to arrange it. */
export default function PageTemplateCard({
  suffixes,
  value,
  contentHref,
  onChange,
}: PageTemplateCardProps) {
  // Hooks
  const {
    form: { template: copy },
  } = useCopy(onlineStoreContent)

  // Event handlers
  const handleChange = (next: unknown) => {
    if (typeof next === 'string') onChange(next === DEFAULT ? '' : next)
  }

  // Render logic
  const items = [
    { value: DEFAULT, label: copy.default },
    ...suffixes.map((s) => ({ value: s, label: s })),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field>
          <Select items={items} value={value || DEFAULT} onValueChange={handleChange}>
            <SelectTrigger className="w-full" aria-label={copy.heading}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{copy.help}</FieldDescription>
        </Field>
        <Button variant="outline" nativeButton={false} render={<Link href={contentHref} />}>
          {copy.editContent}
        </Button>
        <p className="text-caption text-muted-foreground">{copy.editHelp}</p>
      </CardContent>
    </Card>
  )
}
