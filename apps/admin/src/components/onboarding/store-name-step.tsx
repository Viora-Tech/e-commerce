'use client'

import { slugifyStoreName } from '@commerce/core/onboarding'
import { CircleAlert, CircleCheck, Loader2Icon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { onboardingContent as copy } from '@/data/onboarding'
import { api } from '@/lib/api-client'

export type StoreNameValue = { name: string; slug: string; slugEdited: boolean }

type StoreNameStepProps = {
  platformDomain: string
  value: StoreNameValue
  onChange: (value: StoreNameValue) => void
  onNext: () => void
}

type SlugCheck = { status: 'idle' | 'checking' | 'available' | 'problem'; message?: string }

const problemMessage = (problem: string): string =>
  copy.slug.problem[problem as keyof typeof copy.slug.problem] ?? copy.slug.problem.taken

/** Screen 1: store name and address, with a live availability check on the address. */
export default function StoreNameStep({
  platformDomain,
  value,
  onChange,
  onNext,
}: StoreNameStepProps) {
  // Hooks
  const [check, setCheck] = useState<SlugCheck>({ status: 'idle' })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const slug = value.slug
    if (timer.current) clearTimeout(timer.current)
    if (!slug) {
      setCheck({ status: 'idle' })
      return
    }
    setCheck({ status: 'checking' })
    timer.current = setTimeout(async () => {
      try {
        const result = await api.onboarding.slugAvailability({ slug })
        setCheck(
          result.available
            ? { status: 'available' }
            : { status: 'problem', message: problemMessage(result.problem ?? 'taken') },
        )
      } catch {
        setCheck({ status: 'idle' })
      }
    }, 400)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value.slug])

  // Event handlers
  const handleNameChange = (name: string) => {
    onChange({ ...value, name, slug: value.slugEdited ? value.slug : slugifyStoreName(name) })
  }

  const handleSlugChange = (next: string) => {
    onChange({ ...value, slug: slugifyStoreName(next), slugEdited: true })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onNext()
  }

  // Render logic
  const canContinue = value.name.trim().length > 0 && check.status === 'available'
  const invalid = check.status === 'problem' ? true : undefined

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title text-ink-strong">{copy.nameStep.heading}</h1>
          <p className="text-body text-muted-foreground">{copy.nameStep.body}</p>
        </div>
        <Field>
          <FieldLabel htmlFor="onboarding-name">{copy.name.label}</FieldLabel>
          <Input
            id="onboarding-name"
            size="lg"
            value={value.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={copy.name.placeholder}
            autoFocus
            required
          />
        </Field>
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor="onboarding-slug">{copy.slug.label}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id="onboarding-slug"
              size="lg"
              value={value.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              aria-invalid={invalid}
              required
            />
            <span className="text-body text-muted-foreground-soft">
              {copy.slug.suffix(platformDomain)}
            </span>
            {check.status === 'checking' ? (
              <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : check.status === 'available' ? (
              <CircleCheck className="size-4 shrink-0 text-success" />
            ) : check.status === 'problem' ? (
              <CircleAlert className="size-4 shrink-0 text-danger" />
            ) : null}
          </div>
          {check.status === 'problem' ? (
            <FieldError>{check.message}</FieldError>
          ) : (
            <FieldDescription>
              {check.status === 'checking' ? copy.slug.checking : null}
              {check.status === 'available' ? copy.slug.available : null}
            </FieldDescription>
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={!canContinue}>
          {copy.next}
        </Button>
      </FieldGroup>
    </form>
  )
}
