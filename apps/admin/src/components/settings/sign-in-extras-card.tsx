'use client'

import type { CustomerAccountSettings as Settings } from '@commerce/core'
import { customerAccountsContent } from '@/data/customer-accounts'
import { useCopy } from '@/hooks/use-copy'
import SettingsCard from './settings-card'
import SettingsToggleRow from './settings-toggle-row'

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
      {EXTRAS.map((key) => {
        const blocked = key === 'magicLink' && !emailOn
        return (
          <SettingsToggleRow
            key={key}
            id={`extra-${key}`}
            label={copy[key].label}
            description={blocked ? copy.magicLink.needsEmail : copy[key].hint}
            checked={form[key] && !blocked}
            disabled={blocked}
            onChange={(on) => onChange({ ...form, [key]: on })}
          />
        )
      })}
    </SettingsCard>
  )
}
