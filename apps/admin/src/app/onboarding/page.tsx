import { loadEnv } from '@commerce/config'
import { checkSignupGate, userOwnsAStore } from '@commerce/core'
import { redirect } from 'next/navigation'
import InviteOnlyCard from '@/components/onboarding/invite-only-card'
import OnboardingScreen from '@/components/onboarding/onboarding-screen'
import OnboardingWizard from '@/components/onboarding/onboarding-wizard'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const env = loadEnv(process.env)
  const decision = await checkSignupGate(db(), {
    email: session.user.email,
    mode: env.MERCHANT_SIGNUP_MODE,
    ownsAStoreAlready: await userOwnsAStore(db(), session.user.id),
  })

  if (decision.allowed) {
    return (
      <OnboardingWizard
        platformDomain={env.PLATFORM_STORE_DOMAIN}
        defaultName={session.user.name}
      />
    )
  }
  return (
    <OnboardingScreen>
      <InviteOnlyCard defaultEmail={session.user.email} />
    </OnboardingScreen>
  )
}
