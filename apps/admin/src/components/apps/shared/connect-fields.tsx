'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: ConnectFields, ConnectFieldSpec
 * WHAT:  the labelled key boxes of a provider app's Connect page, from a list of field specs.
 * WHY:   one owner for the label / input / help markup instead of hand-written copies per provider;
 *        a spec can swap the input for its own control (RapidShyp's pickup location picker).
 * WHERE: the `fields` slot of ProviderConnectPage in the courier and Decentro Connect wrappers.
 */

import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import type { HTMLAttributes, ReactNode } from 'react'
import type { FieldValues } from './provider-settings'

export type ConnectFieldSpec = {
  key: string
  label: string
  help: string
  type?: 'password' | 'email'
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  /** Replaces the text box; it must carry `id="<providerId>-<key>"` for the label. */
  control?: ReactNode
}

type ConnectFieldsProps = {
  providerId: string
  specs: ConnectFieldSpec[]
  values: FieldValues
  onField: (key: string, value: string) => void
}

export default function ConnectFields({ providerId, specs, values, onField }: ConnectFieldsProps) {
  return (
    <FieldGroup>
      {specs.map((spec) => (
        <Field key={spec.key}>
          <FieldLabel htmlFor={`${providerId}-${spec.key}`}>{spec.label}</FieldLabel>
          {spec.control ?? (
            <Input
              size="lg"
              id={`${providerId}-${spec.key}`}
              type={spec.type}
              inputMode={spec.inputMode}
              autoComplete="off"
              value={values[spec.key]}
              onChange={(e) => onField(spec.key, e.target.value)}
            />
          )}
          <FieldDescription>{spec.help}</FieldDescription>
        </Field>
      ))}
    </FieldGroup>
  )
}
