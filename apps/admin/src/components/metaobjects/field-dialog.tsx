'use client'

import {
  type FieldDefinition,
  type FieldType,
  KEY_PATTERN,
  keyFromName,
  NO_LIST_TYPES,
  ruleProblems,
} from '@commerce/core/metaobjects'
import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { fieldDialogContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import FieldRules from './field-rules'
import FieldTypeSelect from './field-type-select'
import ToggleField from './toggle-field'

type FieldDialogProps = {
  open: boolean
  /** `null` adds a new field. */
  field: FieldDefinition | null
  /** Keys other fields already use. */
  takenKeys: string[]
  /** How many entries hold a value in this field: what goes in it is fixed while any do. */
  filled: number
  targets: { id: string; name: string }[]
  onClose: () => void
  onSave: (field: FieldDefinition) => void
}

type Draft = {
  name: string
  key: string
  keyTouched: boolean
  type: FieldType | null
  list: boolean
  required: boolean
  description: string
  validations: FieldDefinition['validations']
}

function toDraft(field: FieldDefinition | null): Draft {
  return {
    name: field?.name ?? '',
    key: field?.key ?? '',
    keyTouched: Boolean(field),
    type: field?.type ?? null,
    list: field?.list ?? false,
    required: field?.required ?? false,
    description: field?.description ?? '',
    validations: field?.validations ?? {},
  }
}

/** Add or edit one field of a metaobject definition. */
export default function FieldDialog({
  open,
  field,
  takenKeys,
  filled,
  targets,
  onClose,
  onSave,
}: FieldDialogProps) {
  // Hooks
  const copy = useCopy(fieldDialogContent)
  const [draft, setDraft] = useState<Draft>(() => toDraft(field))
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(toDraft(field))
    setAttempted(false)
  }, [open, field])

  // Helpers
  const patch = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }))

  // Event handlers
  const handleName = (name: string) =>
    patch(draft.keyTouched ? { name } : { name, key: keyFromName(name) })

  const handleType = (type: FieldType) =>
    patch({ type, validations: {}, list: NO_LIST_TYPES.includes(type) ? false : draft.list })

  const handleSave = () => {
    setAttempted(true)
    if (problems.length > 0 || !draft.type) return
    onSave({
      key: draft.key,
      name: draft.name.trim(),
      type: draft.type,
      list: draft.list,
      required: draft.required,
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
      ...(draft.validations && Object.keys(draft.validations).length
        ? { validations: draft.validations }
        : {}),
    })
  }

  // Render logic
  const keyError = !KEY_PATTERN.test(draft.key)
    ? copy.keyHelp
    : takenKeys.includes(draft.key)
      ? copy.keyTaken
      : null
  const problems = [
    ...(draft.name.trim() ? [] : [copy.nameRequired]),
    ...(keyError ? [keyError] : []),
    ...(draft.type ? ruleProblems(draft.name, draft.type, draft.validations) : [copy.typeRequired]),
  ]
  const listable = draft.type !== null && !NO_LIST_TYPES.includes(draft.type)
  const locked = Boolean(field) && filled > 0
  const lockedRowKeys = locked ? (field?.validations?.subfields ?? []).map((s) => s.key) : []

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={cn(
          'max-h-[90vh] overflow-y-auto',
          draft.type === 'group' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <DialogHeader>
          <DialogTitle>{field ? copy.editTitle : copy.addTitle}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="field-name">{copy.name}</FieldLabel>
              <Input
                id="field-name"
                size="lg"
                value={draft.name}
                placeholder={copy.namePlaceholder}
                autoFocus
                onChange={(e) => handleName(e.target.value)}
              />
            </Field>
            <Field data-invalid={attempted && Boolean(keyError)}>
              <FieldLabel htmlFor="field-key">{copy.key}</FieldLabel>
              <Input
                id="field-key"
                size="lg"
                value={draft.key}
                autoComplete="off"
                onChange={(e) => patch({ key: e.target.value, keyTouched: true })}
              />
              {attempted && keyError ? <FieldError>{keyError}</FieldError> : null}
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="field-type">{copy.type}</FieldLabel>
            <FieldTypeSelect
              id="field-type"
              value={draft.type}
              disabled={locked}
              onChange={handleType}
            />
            {locked ? <FieldDescription>{copy.typeLocked(filled)}</FieldDescription> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="field-description">{copy.description}</FieldLabel>
            <Input
              id="field-description"
              placeholder={copy.descriptionPlaceholder}
              size="lg"
              value={draft.description}
              maxLength={300}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>
          <ToggleField
            id="field-required"
            label={copy.required}
            help={copy.requiredHelp}
            checked={draft.required}
            onChange={(required) => patch({ required })}
          />
          {listable ? (
            <ToggleField
              id="field-list"
              label={copy.list}
              help={copy.listHelp}
              checked={draft.list}
              disabled={locked}
              onChange={(list) => patch({ list })}
            />
          ) : null}
          {draft.type ? (
            <>
              <FieldSeparator />
              <FieldDescription className="text-body-strong text-foreground">
                {copy.rules}
              </FieldDescription>
              <FieldRules
                type={draft.type}
                list={draft.list}
                validations={draft.validations ?? {}}
                targets={targets}
                shapeLocked={locked}
                lockedRowKeys={lockedRowKeys}
                onChange={(validations) => patch({ validations })}
              />
            </>
          ) : null}
          {attempted && problems.length > 0 && !keyError ? (
            <FieldError>{problems.join('. ')}</FieldError>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button onClick={handleSave}>
            <CheckIcon aria-hidden="true" />
            {copy.done}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
