'use client'

import { useActionState } from 'react'
import { passwordContent as copy } from '@/data/online-store'
import { type UnlockState, unlockStorefront } from '@/lib/password-actions'

const INITIAL: UnlockState = { error: false }

/** Password entry for a locked storefront; the server action sets the signed pass. */
export default function PasswordForm() {
  // Hooks
  const [state, action, pending] = useActionState(unlockStorefront, INITIAL)

  // Render logic
  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <label htmlFor="storefront-password" className="text-sm text-muted">
        {copy.label}
      </label>
      <div className="flex gap-2">
        <input
          id="storefront-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? 'storefront-password-error' : undefined}
          placeholder={copy.password}
          className="field__input min-w-0 flex-1"
        />
        <button type="submit" className="btn btn--secondary" disabled={pending}>
          {copy.submit}
        </button>
      </div>
      {state.error ? (
        <p id="storefront-password-error" role="alert" className="text-sm text-danger">
          {copy.wrong}
        </p>
      ) : null}
    </form>
  )
}
