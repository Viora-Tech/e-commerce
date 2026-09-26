'use client'

import { slugifyStoreName } from '@commerce/core/onboarding'
import { CircleAlert, CircleCheck, Loader2Icon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { onboardingContent as copy } from '@/data/onboarding'
import { api } from '@/lib/api-client'
import { authClient } from '@/lib/auth-client'

type OnboardingFormProps = { platformDomain: string; defaultName: string }

type SlugCheck = { status: 'idle' | 'checking' | 'available' | 'problem'; message?: string }

const problemMessage = (problem: string): string =>
  copy.slug.problem[problem as keyof typeof copy.slug.problem] ?? copy.slug.problem.taken

export default function OnboardingForm({ platformDomain, defaultName }: OnboardingFormProps) {
  // Hooks
  const router = useRouter()
  const [name, setName] = useState(defaultName)
  const [slug, setSlug] = useState(() => slugifyStoreName(defaultName))
  const [slugEdited, setSlugEdited] = useState(false)
  const [check, setCheck] = useState<SlugCheck>({ status: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
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
  }, [slug])

  // Event handlers
  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugEdited) setSlug(slugifyStoreName(value))
  }

  const handleSlugChange = (value: string) => {
    setSlugEdited(true)
    setSlug(slugifyStoreName(value))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const store = await api.onboarding.create({ name, slug })
      await authClient.organization.setActive({ organizationId: store.organizationId })
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.createFailed)
      setSubmitting(false)
    }
  }

  // Render logic
  const canSubmit = !submitting && name.trim().length > 0 && check.status === 'available'

  return (
    <Card size="form" className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-page-title text-ink-strong">{copy.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="onboarding-name">{copy.name.label}</FieldLabel>
              <Input
                id="onboarding-name"
                size="lg"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={copy.name.placeholder}
                autoFocus
                required
              />
            </Field>
            <Field data-invalid={check.status === 'problem' ? true : undefined}>
              <FieldLabel htmlFor="onboarding-slug">{copy.slug.label}</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id="onboarding-slug"
                  size="lg"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  aria-invalid={check.status === 'problem' ? true : undefined}
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
                <FieldDescription>{copy.shopifyNote}</FieldDescription>
              )}
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {submitting ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {submitting ? copy.creating : copy.submit}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
