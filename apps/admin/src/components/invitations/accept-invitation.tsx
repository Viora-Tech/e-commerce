'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { FieldError } from '@commerce/ui/shadcn/field'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { invitationContent } from '@/data/invitations'
import { api } from '@/lib/api-client'
import { authClient } from '@/lib/auth-client'
import InvitationSignIn from './invitation-sign-in'

type AcceptInvitationProps = {
  invitationId: string
  email: string
  storeName: string
  inviterName: string | null
  roleName: string | null
  /** The email of whoever is signed in right now, if anyone. */
  signedInEmail: string | null
}

const copy = invitationContent

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** A pending invitation: sign in as the invited address if needed, then join. */
export default function AcceptInvitation({
  invitationId,
  email,
  storeName,
  inviterName,
  roleName,
  signedInEmail,
}: AcceptInvitationProps) {
  // Hooks
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Helpers
  const join = async () => {
    const joined = await api.invitations.accept({ id: invitationId })
    // Set from the browser so the cached session cookie picks up the new store.
    await authClient.organization.setActive({ organizationId: joined.organizationId })
    // A full load, so client caches (permissions, lists) start fresh for the new store.
    window.location.assign('/')
  }

  // Event handlers
  const handleAccept = async () => {
    setBusy(true)
    setError(null)
    try {
      await join()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : copy.acceptFailed)
    }
  }

  const handleSignOut = async () => {
    setBusy(true)
    await authClient.signOut()
    router.refresh()
  }

  // Render logic
  const wrongAccount = signedInEmail !== null && !sameEmail(signedInEmail, email)
  const signedInAsInvitee = signedInEmail !== null && !wrongAccount

  return (
    <Card size="form" className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-page-title text-ink-strong">
          {wrongAccount ? copy.otherAccount.heading : copy.title(storeName)}
        </CardTitle>
        {wrongAccount ? null : (
          <CardDescription className="text-body">
            {inviterName ? copy.invitedBy(inviterName) : copy.invitedAnon}
            {roleName ? ` ${copy.role(roleName)}` : null}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {wrongAccount ? (
          <>
            <p className="text-body text-muted-foreground">
              {copy.otherAccount.body(signedInEmail ?? '', email)}
            </p>
            <Button className="w-full" variant="outline" onClick={handleSignOut} disabled={busy}>
              {busy ? <Spinner /> : null}
              {copy.otherAccount.signOut}
            </Button>
          </>
        ) : signedInAsInvitee ? (
          <>
            {error ? <FieldError>{error}</FieldError> : null}
            <Button className="w-full" onClick={handleAccept} disabled={busy}>
              {busy ? <Spinner /> : null}
              {copy.accept}
            </Button>
          </>
        ) : (
          <InvitationSignIn email={email} onSignedIn={join} />
        )}
      </CardContent>
    </Card>
  )
}
