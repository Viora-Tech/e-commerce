import { ExternalLink, LogOut } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import type { Metadata } from 'next'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { portalStore, requireAffiliate } from '@/lib/affiliate-portal'
import { portalSignOutAction } from '@/lib/portal-actions'

type SecurityPageProps = { params: Promise<{ storeId: string }> }

const copy = affiliatePortalContent.settings.security

export const metadata: Metadata = { title: affiliatePortalContent.settings.tabs.security }

/**
 * Settings › Security. Affiliates sign in with their store account, so its password-free sign-in
 * methods, passkeys and devices are managed on the store's account page (Profile › Sign-in and
 * security); the portal only logs this browser out.
 */
export default async function SecurityPage({ params }: SecurityPageProps) {
  // Hooks
  const { storeId } = await params
  const { me } = await requireAffiliate(storeId)
  const store = await portalStore(storeId)

  // Render logic
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.help}</CardDescription>
      </CardHeader>
      {me.email ? (
        <CardContent className="text-sm">
          {affiliatePortalContent.settings.profile.email}:{' '}
          <span className="text-muted-foreground">{me.email}</span>
        </CardContent>
      ) : null}
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={`${store.origin}/account/profile`} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink />
          {copy.manage}
        </Button>
        <form action={portalSignOutAction}>
          <Button type="submit" variant="ghost">
            <LogOut />
            {copy.signOut}
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}
