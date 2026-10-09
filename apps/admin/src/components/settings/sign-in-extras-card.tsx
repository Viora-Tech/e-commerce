'use client'

import type { CustomerAccountSettings as Settings } from '@commerce/core'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Switch } from '@commerce/ui/shadcn/switch'
import { customerAccountsContent } from '@/data/customer-accounts'
import { useCopy } from '@/hooks/use-copy'
import SettingsCard from './settings-card'

type SignInExtrasCardProps = {
  form: Settings
  onChange: (next: Settings) => void
}

type Extra = 'magicLink' | 'passkeys' | 'rememberDevice'

const EXTRAS: Extra[] = ['magicLink', 'passkeys', 'rememberDevice']

/** Magic link, passkeys and "Remember this device": a switch each. */
export default function SignInExtrasCard({ form, onChange }: SignInExtrasCardProps) {
  // Hooks
  const copy = useCopy(customerAccountsContent).extras

  // Render logic
  const emailOn = form.loginMethods.includes('email')

  return (
    <SettingsCard id="more-sign-in" title={copy.heading}>
      <FieldGroup>
        {EXTRAS.map((key) => {
          const blocked = key === 'magicLink' && !emailOn
          return (
            <Field key={key} orientation="horizontal" className="items-start justify-between">
              <div className="flex flex-col gap-0.5">
                <FieldLabel htmlFor={`extra-${key}`}>{copy[key].label}</FieldLabel>
                <FieldDescription>
                  {blocked ? copy.magicLink.needsEmail : copy[key].hint}
                </FieldDescription>
              </div>
              <Switch
                id={`extra-${key}`}
                checked={form[key] && !blocked}
                disabled={blocked}
                onCheckedChange={(on) => onChange({ ...form, [key]: on })}
              />
            </Field>
          )
        })}
      </FieldGroup>
    </SettingsCard>
  )
}
