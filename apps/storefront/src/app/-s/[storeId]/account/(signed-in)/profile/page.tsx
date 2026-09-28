import { SOCIAL_PROVIDERS } from '@commerce/core/customer-accounts'
import type { Metadata } from 'next'
import ProfileForm from '@/components/account/profile-form'
import SecurityCard from '@/components/account/security-card'
import { accountContent } from '@/data/account'
import { requireCustomer } from '@/lib/customer-session'
import { requestOrigin, securityOverview } from '@/lib/shopper-login'
import { storeSignIn } from '@/lib/sign-in-methods'

type ProfilePageProps = { params: Promise<{ storeId: string }> }

export const metadata: Metadata = { title: accountContent.profile.title }

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { storeId } = await params
  const me = await requireCustomer(storeId, '/account/profile')
  const [{ options }, overview, { hostname }] = await Promise.all([
    storeSignIn(storeId),
    securityOverview(storeId, me.id),
    requestOrigin(),
  ])
  const linked = new Set(overview.identities.map((i) => i.provider))
  const showSecurity =
    options.passkeys || options.social.length > 0 || overview.identities.length > 0
  return (
    <div className="flex flex-col gap-10">
      <ProfileForm customer={me} />
      {showSecurity ? (
        <SecurityCard
          passkeysOn={options.passkeys}
          passkeys={overview.passkeys.map((p) => ({ id: p.id, name: p.name, rpId: p.rpId }))}
          identities={overview.identities.map((i) => ({
            id: i.id,
            provider: i.provider,
            email: i.email,
          }))}
          connectable={SOCIAL_PROVIDERS.filter((p) => options.social.includes(p) && !linked.has(p))}
          hostname={hostname}
        />
      ) : null}
    </div>
  )
}
