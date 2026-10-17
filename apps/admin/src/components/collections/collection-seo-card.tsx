'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { collectionDetailContent, collectionFormContent } from '@/data/collections'
import { useCopy } from '@/hooks/use-copy'

type CollectionSeoCardProps = {
  seoTitle: string
  seoDescription: string
  /** The collection title, shown when no search title is set. */
  title: string
  /** Storefront host and the collection's handle, for the address line of the preview. */
  host: string
  handle: string | null
  onChange: (patch: { seoTitle?: string; seoDescription?: string }) => void
}

/** "Search engine listing" card: a preview of the search result with an Edit toggle for the fields. */
export default function CollectionSeoCard({
  seoTitle,
  seoDescription,
  title,
  host,
  handle,
  onChange,
}: CollectionSeoCardProps) {
  // Hooks
  const { seo: detail } = useCopy(collectionDetailContent)
  const { seo: copy } = useCopy(collectionFormContent)
  const [editing, setEditing] = useState(false)

  // Render logic
  const shownTitle = seoTitle || title
  const address = [host, 'collections', handle].filter(Boolean).join(' › ')

  return (
    <DataCard
      title={detail.heading}
      action={
        <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
          {editing ? detail.done : detail.edit}
        </Button>
      }
      bodyClassName="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1 rounded-lg bg-muted/60 p-3">
        <span className="truncate text-caption text-muted-foreground">{address}</span>
        {shownTitle || seoDescription ? (
          <>
            <span className="truncate text-body font-medium text-link">{shownTitle}</span>
            <span className="line-clamp-3 text-caption text-muted-foreground">
              {seoDescription}
            </span>
          </>
        ) : (
          <span className="text-caption text-muted-foreground">{detail.fallback}</span>
        )}
      </div>
      {editing ? (
        <>
          <Field>
            <FieldLabel htmlFor="collection-seo-title">{copy.title}</FieldLabel>
            <Input
              id="collection-seo-title"
              value={seoTitle}
              onChange={(e) => onChange({ seoTitle: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="collection-seo-description">{copy.description}</FieldLabel>
            <Textarea
              id="collection-seo-description"
              rows={3}
              value={seoDescription}
              onChange={(e) => onChange({ seoDescription: e.target.value })}
            />
          </Field>
        </>
      ) : null}
    </DataCard>
  )
}
