import { redirect } from 'next/navigation'

/**
 * `/account/register`: Shopify's sign-up page, still linked from search results and old emails
 * after a store moves here. Signing in with a code creates the account, so it lands on sign-in.
 */
export default function AccountRegisterPage() {
  redirect('/account/login')
}
