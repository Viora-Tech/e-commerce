import { describePaymentProvider } from '../testing/payment-conformance'
import { FakePaymentProvider } from './payment'

describePaymentProvider('fake', { create: () => new FakePaymentProvider() })
