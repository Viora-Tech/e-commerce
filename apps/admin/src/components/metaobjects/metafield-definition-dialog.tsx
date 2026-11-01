'use client'

import {
  canFilterBy,
  type FieldType,
  type FieldValidations,
  KEY_PATTERN,
  keyFromName,
  type MetafieldOwnerType,
  NO_LIST_TYPES,
  PRIVATE_METAFIELD_OWNERS,
  ruleProblems,
} from '@commerce/core/metaobjects'
import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
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
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { customDataContent, fieldDialogContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import FieldRules from './field-rules'
import FieldTypeSelect from './field-type-select'
import ToggleField from './toggle-field'

export type MetafieldDefinitionRow = Awaited<
  ReturnType<typeof api.metaobjects.metafieldDefinitions>
>[number]

type MetafieldDefinitionDialogProps = {
  open: boolean
  ownerType: MetafieldOwnerType
  /** `null` adds a new definition. */
  definition: MetafieldDefinitionRow | null
  targets: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}

type Draft = {
  name: string
  namespace: string
  key: string
  keyTouched: boolean
  description: string
  type: FieldType | null
  list: boolean
  validations: FieldValidations
  storefrontAccess: boolean
  filterable: boolean
}

function toDraft(d: MetafieldDefinitionRow | null): Draft {
  return {
    name: d?.name ?? '',
    namespace: d?.namespace ?? 'custom',
    key: d?.key ?? '',
    keyTouched: Boolean(d),
    description: d?.description ?? '',
    type: d?.type ?? null,
    list: d?.list ?? false,
    validations: (d?.validations as FieldValidations | undefined) ?? {},
    storefrontAccess: d?.storefrontAccess ?? true,
    filterable: d?.filterable ?? false,
  }
}

/** Add or edit a product or collection metafield definition. */
export default function MetafieldDefinitionDialog({
  open,
  ownerType,
  definition,
  targets,
  onClose,
  onSaved,
}: MetafieldDefinitionDialogProps) {
  // Hooks
  const { dialog: copy, owners } = useCopy(customDataContent)
  const fieldCopy = useCopy(fieldDialogContent)
  const [draft, setDraft] = useState<Draft>(() => toDraft(definition))
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(toDraft(definition))
    setAttempted(false)
  }, [open, definition])

  // Helpers
  const patch = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }))

  // Event handlers
  const handleName = (name: string) =>
    patch(draft.keyTouched ? { name } : { name, key: keyFromName(name) })

  const handleSave = async () => {
    setAttempted(true)
    if (problems.length > 0 || !draft.type) return
    const write = {
      ownerType,
      name: draft.name.trim(),
      namespace: draft.namespace,
      key: draft.key,
      description: draft.description.trim() || null,
      type: draft.type,
      list: draft.list,
      validations: draft.validations,
      storefrontAccess: draft.storefrontAccess,
      filterable: draft.filterable,
    }
    setBusy(true)
    try {
      if (definition) await api.metaobjects.updateMetafieldDefinition({ id: definition.id, write })
      else await api.metaobjects.createMetafieldDefinition(write)
      toast.success(copy.saved)
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const owner = owners[ownerType]
  const locked = definition !== null
  const keyValid = KEY_PATTERN.test(draft.key) && KEY_PATTERN.test(draft.namespace)
  const problems = [
    ...(draft.name.trim() ? [] : [fieldCopy.nameRequired]),
    ...(keyValid ? [] : [fieldCopy.keyHelp]),
    ...(draft.type
      ? ruleProblems(draft.name, draft.type, draft.validations)
      : [fieldCopy.typeRequired]),
  ]
  const listable = draft.type !== null && !NO_LIST_TYPES.includes(draft.type)
  const filterable = draft.type !== null && canFilterBy({ ownerType, type: draft.type })

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{definition ? copy.editTitle : copy.addTitle(owner)}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="metafield-name">{copy.name}</FieldLabel>
            <Input
              id="metafield-name"
              size="lg"
              value={draft.name}
              placeholder={copy.namePlaceholder}
              autoFocus
              onChange={(e) => handleName(e.target.value)}
            />
          </Field>
          <Field data-invalid={attempted && !keyValid}>
            <FieldLabel htmlFor="metafield-key">{copy.namespaceKey}</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                size="lg"
                aria-label={copy.namespaceKey}
                className="w-32 font-mono"
                value={draft.namespace}
                disabled={locked}
                onChange={(e) => patch({ namespace: e.target.value })}
              />
              <span className="text-muted-foreground">.</span>
              <Input
                id="metafield-key"
                size="lg"
                className="font-mono"
                value={draft.key}
                disabled={locked}
                autoComplete="off"
                onChange={(e) => patch({ key: e.target.value, keyTouched: true })}
              />
            </div>
            <FieldDescription>{copy.namespaceKeyHelp}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="metafield-type">{fieldCopy.type}</FieldLabel>
            <FieldTypeSelect
              id="metafield-type"
              value={draft.type}
              disabled={locked}
              onChange={(type) =>
                patch({
                  type,
                  validations: {},
                  list: NO_LIST_TYPES.includes(type) ? false : draft.list,
                })
              }
            />
            {locked ? <FieldDescription>{copy.fixed}</FieldDescription> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="metafield-description">{copy.description}</FieldLabel>
            <Input
              id="metafield-description"
              placeholder={copy.descriptionPlaceholder}
              size="lg"
              value={draft.description}
              maxLength={300}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>
          {listable ? (
            <ToggleField
              id="metafield-list"
              label={fieldCopy.list}
              help={fieldCopy.listHelp}
              checked={draft.list}
              disabled={locked}
              onChange={(list) => patch({ list })}
            />
          ) : null}
          {PRIVATE_METAFIELD_OWNERS.includes(ownerType) ? (
            <FieldDescription>{copy.privateNote}</FieldDescription>
          ) : (
            <ToggleField
              id="metafield-storefront"
              label={copy.storefront}
              help={copy.storefrontHelp}
              checked={draft.storefrontAccess}
              onChange={(storefrontAccess) => patch({ storefrontAccess })}
            />
          )}
          {filterable ? (
            <ToggleField
              id="metafield-filterable"
              label={copy.filterable}
              help={copy.filterableHelp}
              checked={draft.filterable}
              onChange={(next) => patch({ filterable: next })}
            />
          ) : null}
          {draft.type ? (
            <>
              <FieldSeparator />
              <FieldDescription className="text-body-strong text-foreground">
                {fieldCopy.rules}
              </FieldDescription>
              <FieldRules
                type={draft.type}
                list={draft.list}
                validations={draft.validations}
                targets={targets}
                onChange={(validations) => patch({ validations })}
              />
            </>
          ) : null}
          {attempted && problems.length > 0 ? <FieldError>{problems.join('. ')}</FieldError> : null}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {copy.cancel}
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            <Save aria-hidden="true" />
            {busy ? copy.saving : copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
