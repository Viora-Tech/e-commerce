'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

export function SelectStore({ stores }: { stores: { id: string; name: string; slug: string }[] }) {
  const router = useRouter()

  async function pick(id: string) {
    const { error } = await authClient.organization.setActive({ organizationId: id })
    if (error) return toast.error(error.message ?? 'Could not switch store')
    router.push('/')
    router.refresh()
  }

  return (
    <div className="mx-auto grid w-full max-w-lg gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a store</h1>
        <p className="text-sm text-muted-foreground">
          You can switch stores any time from the sidebar.
        </p>
      </div>
      {stores.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No stores yet</CardTitle>
            <CardDescription>
              Store creation lands with onboarding. For now, ask an owner to invite you.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        stores.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle>{s.name}</CardTitle>
              <CardDescription>{s.slug}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => pick(s.id)}>Open {s.name}</Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
