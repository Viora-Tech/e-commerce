import { notFound, redirect } from 'next/navigation'
import ProfileForm from '@/components/shipping-zones/profile-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { orNoStoreOrMissing } from '@/lib/store-guard'

type Params = { params: Promise<{ id: string }> }

export default async function ShippingProfilePage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const profile = await call(appRouter.shipping.profiles.get, { id }, { context }).catch(
    orNoStoreOrMissing(undefined),
  )
  if (profile === undefined) redirect('/select-store')
  if (!profile) notFound()
  return <ProfileForm key={profile.updatedAt.toISOString()} profile={profile} />
}
