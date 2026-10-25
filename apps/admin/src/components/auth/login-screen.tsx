import LoginBrand from '@/components/auth/login-brand'
import LoginForm from '@/components/auth/login-form'
import LoginPanel from '@/components/auth/login-panel'
import LoginPanelCompact from '@/components/auth/login-panel-compact'
import LanguageField from '@/components/settings/language-field'

type LoginScreenProps = {
  google: boolean
  googleError: string | null
  /** The app-store reviewer's password sign-in is on (REVIEWER_LOGIN_*). */
  password: boolean
  /** Where to go after signing in (an OAuth consent page); the admin home when null. */
  next: string | null
}

export default function LoginScreen({ google, googleError, password, next }: LoginScreenProps) {
  return (
    <main className="grid min-h-svh grid-cols-1 bg-background lg:grid-cols-2 lg:p-3">
      <LoginPanelCompact />
      <div className="flex flex-col px-6 py-6 lg:px-12">
        <header className="flex items-center justify-between">
          <LoginBrand />
          <LanguageField />
        </header>
        <div className="flex flex-1 items-center justify-center py-10">
          <LoginForm google={google} googleError={googleError} password={password} next={next} />
        </div>
      </div>
      <LoginPanel />
    </main>
  )
}
