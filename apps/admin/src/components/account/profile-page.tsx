'use client'

import { MemberProfileInputSchema } from '@commerce/core/member-account'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import SettingsPageHeader from '@/components/settings/settings-page-header'
import SettingsPhoneRow from '@/components/settings/settings-phone-row'
import SettingsRow from '@/components/settings/settings-row'
import SettingsTextRow from '@/components/settings/settings-text-row'
import { accountContent } from '@/data/account'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { authClient } from '@/lib/auth-client'
import AvatarField from './avatar-field'
import DeleteAccountCard from './delete-account-card'

type Profile = Awaited<ReturnType<typeof api.account.profile>>
type Form = { name: string; phone: string }
type Errors = Partial<Record<keyof Form, string>>

const formOf = (p: Profile): Form => ({
  name: p.name,
  phone: p.phone ?? '',
})

/** The schema's first message per field, for the rows under each box. */
function validate(form: Form): Errors {
  const r = MemberProfileInputSchema.safeParse(form)
  if (r.success) return {}
  return Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))
}

/**
 * Better Auth keeps the signed-in user in a short-lived cookie; reading the session fresh
 * rewrites it, so the sidebar and top bar show the new name and photo on the next render.
 */
async function refreshSession() {
  await authClient.getSession({ query: { disableCookieCache: true } })
}

/** Account → Profile: photo, name, email (read-only here) and mobile, with a save bar. */
export default function ProfilePage() {
  // Hooks
  const { profile: copy } = useCopy(accountContent)
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [version, setVersion] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-runs the load after Try again
  useEffect(() => {
    api.account
      .profile()
      .then((p) => {
        setProfile(p)
        setForm(formOf(p))
      })
      .catch(() => setFailed(true))
  }, [version])

  // Helpers
  const applySaved = async (p: Profile | null) => {
    if (!p) throw new Error(copy.failed)
    setProfile(p)
    setForm(formOf(p))
    await refreshSession()
    router.refresh()
  }

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setAttempted(true)
    if (Object.keys(validate(form)).length) return
    setSaving(true)
    try {
      await applySaved(await api.account.updateProfile(form))
      setAttempted(false)
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (profile) setForm(formOf(profile))
    setAttempted(false)
  }

  const handleUpload = async (photo: string) => {
    await applySaved(await api.account.setAvatar({ photo }))
  }

  const handleRemovePhoto = async () => {
    await applySaved(await api.account.removeAvatar())
  }

  const handleRetry = () => {
    setFailed(false)
    setVersion((n) => n + 1)
  }

  // Early returns
  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        <SettingsPageHeader title={copy.title} subtitle={copy.intro} hideBack />
        <Card gap={3} inset={6} className="items-start">
          <p className="text-body text-muted-foreground">{copy.loadFailed}</p>
          <Button variant="outline" onClick={handleRetry}>
            {copy.retry}
          </Button>
        </Card>
      </div>
    )
  }

  // Render logic
  const saved = profile ? formOf(profile) : null
  const dirty =
    saved !== null && form !== null && (form.name !== saved.name || form.phone !== saved.phone)
  const errors = form && attempted ? validate(form) : {}

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={saving}
      />
      <SettingsPageHeader
        title={copy.title}
        subtitle={copy.intro}
        hideBack
        onSave={handleSave}
        dirty={dirty}
        saving={saving}
        saveLabel={copy.save}
      />
      {!profile || !form ? (
        <>
          <Card gap={4} inset={6}>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="size-20 rounded-full" />
          </Card>
          <Card gap={4} inset={6}>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        </>
      ) : (
        <>
          <SettingsCard id="photo" title={copy.photo.heading} description={copy.photo.body}>
            <AvatarField
              name={form.name || profile.name}
              email={profile.email}
              image={profile.image}
              onUpload={handleUpload}
              onRemove={handleRemovePhoto}
            />
          </SettingsCard>
          <SettingsCard id="details" title={copy.details.heading} description={copy.details.body}>
            <SettingsTextRow
              id="profile-name"
              label={copy.details.name}
              description={copy.details.nameHelp}
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
              error={errors.name}
              autoComplete="name"
            />
            <SettingsRow label={copy.details.email} description={copy.details.emailHelp}>
              <p className="flex h-10 items-center truncate text-body text-ink-strong">
                {profile.email}
              </p>
            </SettingsRow>
            <SettingsPhoneRow
              id="profile-phone"
              label={copy.details.phone}
              description={copy.details.phoneHelp}
              value={form.phone}
              onChange={(phone) => setForm({ ...form, phone })}
              error={errors.phone}
            />
          </SettingsCard>
          <DeleteAccountCard />
        </>
      )}
    </div>
  )
}
