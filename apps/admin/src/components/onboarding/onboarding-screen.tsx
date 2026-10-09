import type { ReactNode } from 'react'
import LoginBrand from '@/components/auth/login-brand'
import LoginPanel from '@/components/auth/login-panel'
import LoginPanelCompact from '@/components/auth/login-panel-compact'
import LanguageField from '@/components/settings/language-field'

/** /onboarding frame: the login's two-column look, the question card on the left, the brand panel on the right. */
export default function OnboardingScreen({ children }: { children: ReactNode }) {
  // Render logic
  return (
    <main className="grid min-h-svh grid-cols-1 bg-background lg:grid-cols-2 lg:p-3">
      <LoginPanelCompact />
      <div className="flex flex-col px-6 py-6 lg:px-12">
        <header className="flex items-center justify-between">
          <LoginBrand />
          <LanguageField />
        </header>
        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
      </div>
      <LoginPanel />
    </main>
  )
}
