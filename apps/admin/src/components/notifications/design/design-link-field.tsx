'use client'

import { isSafeLink } from '@commerce/notifications/design'
import { LinkIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import BuilderLinkDialog from '@/components/growth/campaigns/visual-builder/builder-link-dialog'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'

type DesignLinkFieldProps = {
  id: string
  value: string
  /** An image's link may stay empty; a button's may not. */
  optional?: boolean
  onChange: (value: string) => void
}

/**
 * A link for a button or image: typed (https, mailto or a word like `{{order_url}}`), or picked
 * from the store's products and collections with the campaign builder's link picker.
 */
export default function DesignLinkField({ id, value, optional, onChange }: DesignLinkFieldProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const [picking, setPicking] = useState(false)

  // Event handlers
  const handlePicked = (path: string | null) => {
    setPicking(false)
    if (path) onChange(`{{shop_url}}${path}`)
  }

  // Render logic
  const bad = (value.trim() !== '' || !optional) && !isSafeLink(value)

  return (
    <Field data-invalid={bad || undefined}>
      <FieldLabel htmlFor={id}>{copy.fields.link}</FieldLabel>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          inputMode="url"
          autoComplete="off"
          aria-invalid={bad || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={() => setPicking(true)}>
          <LinkIcon aria-hidden="true" />
          {copy.fields.pickPage}
        </Button>
      </div>
      {bad ? (
        <FieldError>{copy.fields.badLink}</FieldError>
      ) : (
        <FieldDescription>{copy.fields.linkHint}</FieldDescription>
      )}
      <BuilderLinkDialog open={picking} onDone={handlePicked} />
    </Field>
  )
}
