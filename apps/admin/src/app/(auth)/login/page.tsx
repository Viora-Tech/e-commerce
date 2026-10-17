import { loadEnv, merchantGoogleSignIn } from '@commerce/config'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import LoginScreen from '@/components/auth/login-screen'
import { getSession } from '@/lib/auth'
import { routes, safeNext } from '@/lib/routes'

type LoginPageProps = {
  /** `error` is Better Auth's code when Google sign-in came back refused. */
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Per request: the image is built without the MERCHANT_GOOGLE_* keys.
  await connection()
  // Already signed in: the admin home decides where to go (dashboard, or onboarding without a store).
  const { error, next: rawNext } = await searchParams
  const next = safeNext(rawNext)
  if (await getSession()) redirect(next ?? routes.home())
  const google = merchantGoogleSignIn(loadEnv(process.env)) !== null
  return (
    <LoginScreen
      google={google}
      googleError={typeof error === 'string' ? error : null}
      next={next}
    />
  )
}
