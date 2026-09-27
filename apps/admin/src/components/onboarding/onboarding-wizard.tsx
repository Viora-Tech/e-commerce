'use client'

import { type SellsOn, type SellsWhat, slugifyStoreName } from '@commerce/core/onboarding'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { onboardingContent } from '@/data/onboarding'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { authClient } from '@/lib/auth-client'
import LocationStep, { type LocationValue } from './location-step'
import SellsOnStep from './sells-on-step'
import SellsWhatStep from './sells-what-step'
import StepProgress from './step-progress'
import StoreNameStep, { type StoreNameValue } from './store-name-step'

type OnboardingWizardProps = { platformDomain: string; defaultName: string }

const TOTAL_STEPS = 4

/**
 * /onboarding: one question per screen (name and address → what you sell →
 * where you are based → where you sell today). Nothing is saved until the
 * last screen, so Back and a page refresh are both safe.
 */
export default function OnboardingWizard({ platformDomain, defaultName }: OnboardingWizardProps) {
  // Hooks
  const copy = useCopy(onboardingContent)
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [store, setStore] = useState<StoreNameValue>({
    name: defaultName,
    slug: slugifyStoreName(defaultName),
    slugEdited: false,
  })
  const [sells, setSells] = useState<SellsWhat | null>(null)
  const [location, setLocation] = useState<LocationValue>({ country: 'IN', state: '' })
  const [sellsOn, setSellsOn] = useState<SellsOn | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))

  const handleBack = () => {
    setError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  const handleSubmit = async () => {
    if (!sells || !sellsOn) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await api.onboarding.create({
        name: store.name,
        slug: store.slug,
        profile: { sells, sellsOn, country: location.country, state: location.state },
      })
      await authClient.organization.setActive({ organizationId: created.organizationId })
      router.push(created.nextPath)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.createFailed)
      setSubmitting(false)
    }
  }

  return (
    <Card size="form" className="w-full max-w-md">
      <CardContent className="flex flex-col gap-5">
        <StepProgress
          step={step}
          total={TOTAL_STEPS}
          onBack={step > 0 ? handleBack : undefined}
          disabled={submitting}
        />
        {step === 0 ? (
          <StoreNameStep
            platformDomain={platformDomain}
            value={store}
            onChange={setStore}
            onNext={handleNext}
          />
        ) : step === 1 ? (
          <SellsWhatStep value={sells} onChange={setSells} onNext={handleNext} />
        ) : step === 2 ? (
          <LocationStep value={location} onChange={setLocation} onNext={handleNext} />
        ) : (
          <SellsOnStep
            value={sellsOn}
            onChange={setSellsOn}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={error}
          />
        )}
      </CardContent>
    </Card>
  )
}
