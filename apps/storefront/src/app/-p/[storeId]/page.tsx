import { loadEnv } from '@commerce/config'
import { liveThemeSettings, parsePreferences } from '@commerce/core'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import PasswordForm from '@/components/privacy/password-form'
import { passwordContent as copy } from '@/data/online-store'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string }> }

async function load(storeId: string) {
  return inStore(storeId, async (tx) => {
    const [s] = await tx
      .select({ name: store.name, preferences: store.preferences })
      .from(store)
      .where(eq(store.id, storeId))
    return s ? { ...s, theme: await liveThemeSettings(tx, storeId) } : null
  })
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const s = await load((await params).storeId)
  return { title: s?.name ?? copy.title }
}

/** Shopify-style password page: logo or name, the merchant's message, the password form. */
export default async function PasswordPage({ params }: Params) {
  const { storeId } = await params
  const s = await load(storeId)

  if (!s) notFound()
  const message = parsePreferences(s.preferences).password.message || copy.title
  const logo = s.theme.brand.logo
  return (
    <main className="grid min-h-svh w-full place-items-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        {logo ? (
          <Image
            src={logo.url}
            alt={s.name}
            width={s.theme.brand.logoWidth}
            height={Math.round(s.theme.brand.logoWidth / 2)}
            className="h-auto max-w-full object-contain"
          />
        ) : (
          <p className="font-heading text-2xl font-bold">{s.name}</p>
        )}
        <h1 className="h2 whitespace-pre-line">{message}</h1>
        <PasswordForm />
        <p className="text-sm text-muted">
          {copy.owner}{' '}
          <a href={loadEnv(process.env).ADMIN_URL} className="underline underline-offset-4">
            {copy.ownerLink}
          </a>
        </p>
      </div>
    </main>
  )
}
