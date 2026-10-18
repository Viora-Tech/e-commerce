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
      <div className="flex w-full max-w-md flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-6 md:p-8">
        {logo ? (
          <Image
            src={logo.url}
            alt={s.name}
            width={s.theme.brand.logoWidth}
            height={Math.round(s.theme.brand.logoWidth / 2)}
            className="h-auto max-h-8 w-auto max-w-[10rem] object-contain object-left"
          />
        ) : (
          <p className="font-heading text-lg font-bold uppercase">{s.name}</p>
        )}
        <h1 className="section-title whitespace-pre-line border-b border-line pb-5">{message}</h1>
        <PasswordForm />
        <p className="text-xs text-muted">
          {copy.owner}{' '}
          <a href={loadEnv(process.env).ADMIN_URL} className="text-ink">
            {copy.ownerLink}
          </a>
        </p>
      </div>
    </main>
  )
}
