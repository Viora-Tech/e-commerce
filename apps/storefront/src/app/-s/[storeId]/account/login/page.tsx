import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import LoginForm from '@/components/account/login-form'
import { accountContent } from '@/data/account'
import { currentCustomer, safeReturnTo } from '@/lib/customer-session'

type LoginPageProps = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ return_to?: string }>
}

export const metadata: Metadata = { title: accountContent.login.title }

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { storeId } = await params
  const returnTo = safeReturnTo((await searchParams).return_to)
  if (await currentCustomer(storeId)) redirect(returnTo)
  return (
    <div className="py-6 md:py-12">
      <LoginForm returnTo={returnTo} />
    </div>
  )
}
