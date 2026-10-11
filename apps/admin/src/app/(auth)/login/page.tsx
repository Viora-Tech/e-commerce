import { loadEnv, merchantGoogleSignIn } from '@commerce/config'
import { connection } from 'next/server'
import LoginScreen from '@/components/auth/login-screen'

type LoginPageProps = {
  /** `error` is Better Auth's code when Google sign-in came back refused. */
  searchParams: Promise<{ error?: string | string[] }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Per request: the image is built without the MERCHANT_GOOGLE_* keys.
  await connection()
  const { error } = await searchParams
  const google = merchantGoogleSignIn(loadEnv(process.env)) !== null
  return <LoginScreen google={google} googleError={typeof error === 'string' ? error : null} />
}
