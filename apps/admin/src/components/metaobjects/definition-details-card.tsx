'use client'

import { keyFromName } from '@commerce/core/metaobjects'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { definitionFormContent } from '@/data/metaobjects'

type DetailsPatch = { name?: string; type?: string; description?: string }

type DefinitionDetailsCardProps = {
  name: string
  type: string
  description: string
  /** The type handle is fixed once entries exist. */
  typeLocked: boolean
  /** New definitions follow the name until the type is typed by hand. */
  followName: boolean
  onChange: (patch: DetailsPatch) => void
  onTypeEdited: () => void
}

const copy = definitionFormContent.details

/** Name, type handle and description of a metaobject definition. */
export default function DefinitionDetailsCard({
  name,
  type,
  description,
  typeLocked,
  followName,
  onChange,
  onTypeEdited,
}: DefinitionDetailsCardProps) {
  // Event handlers
  const handleName = (next: string) =>
    onChange(
      followName ? { name: next, type: next.trim() ? keyFromName(next) : '' } : { name: next },
    )

  const handleType = (next: string) => {
    onTypeEdited()
    onChange({ type: next })
  }

  // Render logic
  return (
    <Card size="form">
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="definition-name">{copy.name}</FieldLabel>
            <Input
              id="definition-name"
              size="lg"
              value={name}
              placeholder={copy.namePlaceholder}
              maxLength={100}
              onChange={(e) => handleName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="definition-type">{copy.type}</FieldLabel>
            <Input
              id="definition-type"
              size="lg"
              value={type}
              disabled={typeLocked}
              autoComplete="off"
              className="font-mono"
              onChange={(e) => handleType(e.target.value)}
            />
            <FieldDescription>{copy.typeHelp}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="definition-description">{copy.description}</FieldLabel>
            <Input
              id="definition-description"
              size="lg"
              value={description}
              maxLength={300}
              onChange={(e) => onChange({ description: e.target.value })}
            />
            <FieldDescription>{copy.descriptionHelp}</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
