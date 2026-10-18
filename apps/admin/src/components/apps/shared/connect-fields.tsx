'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: ConnectFields, ConnectFieldSpec
 * WHAT:  the labelled key boxes of a provider app's Connect page, from a list of field specs.
 * WHY:   one owner for the label / input / help markup instead of hand-written copies per provider;
 *        a spec can swap the input for its own control (RapidShyp's pickup location picker).
 * WHERE: the `fields` slot of ProviderConnectPage in the courier and Decentro Connect wrappers.
 */

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import type { HTMLAttributes, ReactNode } from 'react'
import { connectAsideContent } from '@/data/connect-aside'
import { useCopy } from '@/hooks/use-copy'
import type { FieldValues } from './provider-settings'

export type ConnectFieldSpec = {
  key: string
  label: string
  help: string
  type?: 'password' | 'email'
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  /** Replaces the text box; it must carry `id="<providerId>-<key>"` for the label. */
  control?: ReactNode
  /** A 6-digit Indian PIN code: says so under the box while what is typed is not one. */
  pincode?: boolean
}

type ConnectFieldsProps = {
  providerId: string
  specs: ConnectFieldSpec[]
  values: FieldValues
  onField: (key: string, value: string) => void
}

const PINCODE = /^\d{6}$/

/** A typed value that is not a PIN code yet; empty is fine (the test asks for it). */
const badPincode = (spec: ConnectFieldSpec, value: string | undefined) =>
  spec.pincode === true && (value ?? '').trim() !== '' && !PINCODE.test((value ?? '').trim())

export default function ConnectFields({ providerId, specs, values, onField }: ConnectFieldsProps) {
  // Hooks
  const copy = useCopy(connectAsideContent)

  // Render logic
  return (
    <FieldGroup>
      {specs.map((spec) => (
        <Field key={spec.key} data-invalid={badPincode(spec, values[spec.key]) || undefined}>
          <FieldLabel htmlFor={`${providerId}-${spec.key}`}>{spec.label}</FieldLabel>
          {spec.control ?? (
            <Input
              size="lg"
              id={`${providerId}-${spec.key}`}
              type={spec.type}
              inputMode={spec.inputMode}
              autoComplete="off"
              aria-invalid={badPincode(spec, values[spec.key]) || undefined}
              value={values[spec.key]}
              onChange={(e) => onField(spec.key, e.target.value)}
            />
          )}
          {badPincode(spec, values[spec.key]) ? (
            <FieldError>{copy.pinInvalid}</FieldError>
          ) : (
            <FieldDescription>{spec.help}</FieldDescription>
          )}
        </Field>
      ))}
    </FieldGroup>
  )
}
