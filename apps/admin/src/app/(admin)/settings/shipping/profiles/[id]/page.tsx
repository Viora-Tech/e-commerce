import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import ProfileForm from '@/components/shipping-zones/profile-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStoreOrMissing } from '@/lib/store-guard'

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const context = await serverContext()
  const found = await call(appRouter.shipping.profiles.get, { id }, { context }).catch(() => null)
  return { title: found?.name || 'Shipping profile' }
}

export default async function ShippingProfilePage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const profile = await call(appRouter.shipping.profiles.get, { id }, { context }).catch(
    orNoStoreOrMissing(undefined),
  )
  if (profile === undefined) redirect(routes.selectStore())
  if (!profile) notFound()
  // General with no areas cannot ship once another profile has areas (`quoteProfiles`).
  const othersHaveAreas = profile.isDefault
    ? (await call(appRouter.shipping.profiles.list, undefined, { context })).some(
        (p) => !p.isDefault && p.zones.length > 0,
      )
    : false
  return (
    <ProfileForm
      key={profile.updatedAt.toISOString()}
      profile={profile}
      othersHaveAreas={othersHaveAreas}
    />
  )
}
