import AcceptInvitation from '@/components/invitations/accept-invitation'
import InvitationStateCard from '@/components/invitations/invitation-state-card'
import { appRouter, call, serverContext } from '@/lib/api'
import { getSession } from '@/lib/auth'

type AcceptInvitationPageProps = { params: Promise<{ id: string }> }

export default async function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
  const { id } = await params
  const context = await serverContext()
  const [preview, session] = await Promise.all([
    call(appRouter.invitations.preview, { id }, { context }),
    getSession(),
  ])

  return (
    <main className="flex min-h-svh items-start justify-center px-4 pt-[12vh]">
      {preview.state === 'pending' ? (
        <AcceptInvitation
          invitationId={id}
          email={preview.email}
          storeName={preview.storeName}
          inviterName={preview.inviterName}
          roleName={preview.roleName}
          signedInEmail={session?.user.email ?? null}
        />
      ) : (
        <InvitationStateCard state={preview.state} />
      )}
    </main>
  )
}
