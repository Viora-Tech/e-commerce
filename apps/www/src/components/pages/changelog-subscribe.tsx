'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useActionState } from 'react'
import { changelogContent } from '@/data/changelog'
import { FORM_INITIAL } from '@/lib/form-state'
import { subscribeChangelog } from '@/lib/forms-action'

const copy = changelogContent.subscribe

export default function ChangelogSubscribe() {
  // Hooks
  const [state, formAction, pending] = useActionState(subscribeChangelog, FORM_INITIAL)

  return (
    <div className="flex flex-col items-center gap-3">
      <form
        action={formAction}
        noValidate
        className="surface-glass flex w-full max-w-md items-center gap-2 rounded-full p-1 pl-4"
      >
        <label htmlFor="changelog-email" className="sr-only">
          {copy.label}
        </label>
        <Input
          id="changelog-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={copy.placeholder}
          aria-invalid={state.errors.email ? true : undefined}
          className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        <Button
          type="submit"
          variant="secondary"
          size="lg"
          loading={pending}
          className="rounded-full"
        >
          {copy.button}
        </Button>
      </form>
      {state.status === 'invalid' ? (
        <p role="alert" className="text-sm text-destructive">
          {state.errors.email}
        </p>
      ) : null}
      {state.status === 'success' ? (
        <p role="status" className="text-sm text-foreground">
          {copy.done}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{copy.note}</p>
      )}
    </div>
  )
}
