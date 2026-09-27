import { loadEnv } from '@commerce/config'
import { checkSignupGate } from '@commerce/core'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import InviteOnlyCard from '@/components/onboarding/invite-only-card'
import OnboardingWizard from '@/components/onboarding/onboarding-wizard'
import LanguageField from '@/components/settings/language-field'
import { auth, getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const orgs = await auth().api.listOrganizations({ headers: await headers() })
  const env = loadEnv(process.env)
  const decision = await checkSignupGate(db(), {
    email: session.user.email,
    mode: env.MERCHANT_SIGNUP_MODE,
    ownsAStoreAlready: orgs.length > 0,
  })

  return (
    <main className="relative flex min-h-svh items-start justify-center px-4 pt-[8vh] pb-8">
      {/* No Settings yet on this screen, so the language switch sits in the corner. */}
      <div className="absolute top-4 right-4">
        <LanguageField />
      </div>
      {decision.allowed ? (
        <OnboardingWizard
          platformDomain={env.PLATFORM_STORE_DOMAIN}
          defaultName={session.user.name}
        />
      ) : (
        <InviteOnlyCard defaultEmail={session.user.email} />
      )}
    </main>
  )
}
