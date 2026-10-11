import { loadEnv, merchantGoogleSignIn } from '@commerce/config'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import LoginScreen from '@/components/auth/login-screen'
import { getSession } from '@/lib/auth'
import { routes } from '@/lib/routes'

type LoginPageProps = {
  /** `error` is Better Auth's code when Google sign-in came back refused. */
  searchParams: Promise<{ error?: string | string[] }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Per request: the image is built without the MERCHANT_GOOGLE_* keys.
  await connection()
  // Already signed in: the admin home decides where to go (dashboard, or onboarding without a store).
  if (await getSession()) redirect(routes.home())
  const { error } = await searchParams
  const google = merchantGoogleSignIn(loadEnv(process.env)) !== null
  return <LoginScreen google={google} googleError={typeof error === 'string' ? error : null} />
}
