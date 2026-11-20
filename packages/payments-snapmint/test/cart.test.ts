import type { CreatePaymentInput } from '@commerce/payments'
import { describe, expect, it } from 'vitest'
import {
  buildSnapmintCart,
  buildSnapmintOrderId,
  paiseToRupees,
  rupeesToPaise,
  SnapmintInputError,
  snapmintMobile,
  splitName,
} from '../src/cart'

/** Made-up shopper and order; no real person or merchant. */
const input: CreatePaymentInput = {
  orderId: '1a2b3c4d-0000-4000-8000-000000000001',
  orderNumber: 1042,
  amountPaise: 1234550,
  currency: 'INR',
  idempotencyKey: '1a2b3c4d-0000-4000-8000-000000000001:2',
  customer: {
    name: 'Asha Rani Verma',
    email: 'asha@example.com',
    phone: '+91 98765 43210',
    ip: '203.0.113.7',
  },
  shipping: {
    name: 'Asha Rani Verma',
    line1: 'Flat 4, Example Towers',
    line2: 'Sector 9',
    city: 'Pune',
    state: 'MH',
    stateName: 'Maharashtra',
    postalCode: '411001',
    country: 'IN',
  },
  lines: [
    { title: 'Kurta / Blue', quantity: 2, unitPricePaise: 499950, sku: 'KUR-BLU' },
    { title: 'Dupatta', quantity: 1, unitPricePaise: 234650 },
  ],
  storefrontOrigin: 'https://shop.example.in',
}

describe('money', () => {
  it('turns paise into rupees with two decimals and back', () => {
    expect(paiseToRupees(1234550)).toBe(12345.5)
    expect(paiseToRupees(1)).toBe(0.01)
    expect(rupeesToPaise(12345.5)).toBe(1234550)
    expect(rupeesToPaise('5678.56')).toBe(567856)
    expect(rupeesToPaise('0.29')).toBe(29)
    expect(rupeesToPaise(null)).toBeNaN()
    expect(rupeesToPaise('abc')).toBeNaN()
  })
})

describe('snapmintMobile', () => {
  it('keeps a 10-digit Indian mobile and drops +91 or a leading 0', () => {
    expect(snapmintMobile('9876543210')).toBe('9876543210')
    expect(snapmintMobile('+91 98765-43210')).toBe('9876543210')
    expect(snapmintMobile('09876543210')).toBe('9876543210')
  })
  it('refuses landlines, short numbers and foreign numbers', () => {
    expect(snapmintMobile('2212345678')).toBeNull()
    expect(snapmintMobile('98765')).toBeNull()
    expect(snapmintMobile('+44 7700 900123')).toBeNull()
    expect(snapmintMobile(undefined)).toBeNull()
  })
})

describe('splitName', () => {
  it('splits first, middle and last', () => {
    expect(splitName('Asha Rani Verma')).toEqual({
      firstName: 'Asha',
      middleName: 'Rani',
      lastName: 'Verma',
    })
    expect(splitName('  Ravi   Kumar ')).toEqual({
      firstName: 'Ravi',
      middleName: '',
      lastName: 'Kumar',
    })
    expect(splitName('Madhu')).toEqual({ firstName: 'Madhu', middleName: '', lastName: '' })
    expect(splitName('')).toEqual({ firstName: '', middleName: '', lastName: '' })
  })
})

describe('buildSnapmintOrderId', () => {
  it('uses the order number, the order id and the attempt', () => {
    expect(buildSnapmintOrderId(input)).toBe('o1042_1a2b3c4d_2')
    expect(buildSnapmintOrderId({ ...input, orderNumber: undefined, draftNumber: 57 })).toBe(
      'd57_1a2b3c4d_2',
    )
  })
})

describe('buildSnapmintCart', () => {
  it('maps the order to the create-checkout body', () => {
    const body = buildSnapmintCart(input, '12345')
    expect(body).toEqual({
      merchantOrderId: 'o1042_1a2b3c4d_2',
      orderValue: '12345.50',
      ip: '203.0.113.7',
      products: [
        { sku: 'KUR-BLU', name: 'Kurta / Blue', unitPrice: 4999.5, quantity: 2, itemUrl: '' },
        { sku: '', name: 'Dupatta', unitPrice: 2346.5, quantity: 1, itemUrl: '' },
      ],
      merchantId: 12345,
      merchantConfirmationUrl: 'https://shop.example.in/checkout/return/snapmint?outcome=success',
      merchantFailureUrl: 'https://shop.example.in/checkout/return/snapmint?outcome=failure',
      mobile: '9876543210',
      firstName: 'Asha',
      middleName: 'Rani',
      lastName: 'Verma',
      billingAddress: {
        addressLine1: 'Flat 4, Example Towers',
        addressLine2: 'Sector 9',
        zip: 411001,
        city: 'Pune',
        state: 'Maharashtra',
      },
      shippingAddress: {
        addressLine1: 'Flat 4, Example Towers',
        addressLine2: 'Sector 9',
        zip: 411001,
        city: 'Pune',
        state: 'Maharashtra',
      },
      email: 'asha@example.com',
    })
  })

  it('sends a separate billing address, and no email when there is none', () => {
    const body = buildSnapmintCart(
      {
        ...input,
        customer: { ...input.customer, email: undefined },
        billing: {
          name: 'Asha Verma',
          line1: 'Office 2',
          city: 'Mumbai',
          state: 'MH',
          postalCode: '400001',
          country: 'IN',
        },
      },
      '12345',
    )
    expect(body.billingAddress).toEqual({
      addressLine1: 'Office 2',
      zip: 400001,
      city: 'Mumbai',
      state: 'MH',
    })
    expect(body).not.toHaveProperty('email')
  })

  it('refuses what Snapmint would refuse', () => {
    const bad = (patch: Partial<CreatePaymentInput>) => () =>
      buildSnapmintCart({ ...input, ...patch }, '12345')
    expect(bad({ customer: { ...input.customer, phone: '12345' } })).toThrow(SnapmintInputError)
    expect(bad({ customer: { ...input.customer, ip: 'unknown' } })).toThrow(/IP address/)
    expect(bad({ shipping: undefined })).toThrow(/delivery address/)
    expect(bad({ storefrontOrigin: undefined })).toThrow(/store address/)
    expect(bad({ currency: 'USD' as 'INR' })).toThrow(/rupee/)
  })
})
