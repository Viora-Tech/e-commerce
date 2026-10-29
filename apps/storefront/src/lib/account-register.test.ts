import { describe, expect, it } from 'vitest'
import AccountRegisterPage from '@/app/-s/[storeId]/account/register/page'

// The live review (29 Oct) found Shopify's `/account/register` answering 404 after the move.
describe('/account/register', () => {
  it('sends the shopper to sign-in, which creates the account', () => {
    let digest = ''
    try {
      AccountRegisterPage()
    } catch (error) {
      digest = String((error as { digest?: string }).digest)
    }
    expect(digest).toContain(';/account/login;')
  })
})
