import { describePaymentProvider } from '@commerce/payments/testing'
import { CodPaymentProvider } from './cod'
import { FakePaymentProvider } from './payment'

describePaymentProvider('fake', { create: () => new FakePaymentProvider() })
describePaymentProvider('cod', { create: () => new CodPaymentProvider() })
