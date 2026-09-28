/** SOURCE OF TRUTH: policy template tests — filled facts, India wording (E-Commerce Rules 2020, DPDP Act 2023), rich text shape, missing details and policy helpers */
import { describe, expect, it } from 'vitest'
import { emptyStoreAddress } from '../settings/general'
import {
  grievanceOfficerOf,
  missingRequiredPolicies,
  POLICY_TYPES,
  parsePolicySettings,
  policyPath,
  policyTypeOfHandle,
  transitRange,
} from './client'
import {
  fillPolicyTemplate,
  missingTemplateDetails,
  type PolicyNode,
  type PolicyTemplateInput,
} from './templates'

const input: PolicyTemplateInput = {
  storeName: 'Waimers',
  legalName: 'Waimers Tech Private Limited',
  address: {
    line1: 'Plot 4, Sector 18',
    line2: '',
    city: 'Gurugram',
    state: 'HR',
    pincode: '122015',
    country: 'IN',
  },
  email: 'care@waimers.in',
  phone: '+91 98765 43210',
  gstin: '06AAACW1234A1Z2',
  website: 'waimers.in',
  returns: { enabled: true, windowDays: 10, refundMethod: 'original' },
  shipping: { minDays: 2, maxDays: 6, codAllowed: true, freeAbovePaise: 99_900 },
  grievanceOfficer: {
    name: 'Kuldeep Saini',
    designation: 'Founder',
    email: 'grievance@waimers.in',
    phone: '+91 90000 00000',
  },
}

function plain(node: PolicyNode): string {
  if (typeof node.text === 'string') return node.text
  return (node.children ?? []).map(plain).join('\n')
}

const textOf = (type: (typeof POLICY_TYPES)[number], i: PolicyTemplateInput = input) =>
  plain(fillPolicyTemplate(type, i).root)

describe('policy templates', () => {
  it('fill seller details, the grievance officer and the return window into the refund policy', () => {
    const t = textOf('refund-policy')
    expect(t).toContain('Waimers Tech Private Limited')
    expect(t).toContain('Plot 4, Sector 18, Gurugram, Haryana 122015')
    expect(t).toContain('GSTIN: 06AAACW1234A1Z2')
    expect(t).toContain('within 10 days of delivery')
    expect(t).toContain('Name: Kuldeep Saini')
    expect(t).toContain('Designation: Founder')
    expect(t).toMatch(/acknowledge every complaint within 48 hours/)
    expect(t).toMatch(/within 7 working days/)
  })

  it('say returns are for faulty items only when returns are off', () => {
    const t = textOf('refund-policy', { ...input, returns: { ...input.returns, enabled: false } })
    expect(t).toContain('We do not take returns for a change of mind')
    expect(t).not.toContain('within 10 days of delivery')
  })

  it('offer store credit wording when that is the refund default', () => {
    const t = textOf('refund-policy', {
      ...input,
      returns: { ...input.returns, refundMethod: 'store_credit' },
    })
    expect(t).toContain('as store credit')
  })

  it('put shipping times from the zones and free shipping into the shipping policy', () => {
    const t = textOf('shipping-policy')
    expect(t).toContain('usually delivered in 2 to 6 days')
    expect(t).toContain('₹999')
    expect(t).toContain('Cash on delivery')
    const noCod = textOf('shipping-policy', {
      ...input,
      shipping: { minDays: 4, maxDays: 4, codAllowed: false, freeAbovePaise: null },
    })
    expect(noCod).toContain('usually delivered in 4 days')
    expect(noCod).not.toContain('Cash on delivery')
  })

  it('use DPDP Act 2023 wording in the privacy policy', () => {
    const t = textOf('privacy-policy')
    expect(t).toContain('Digital Personal Data Protection Act, 2023')
    expect(t).toContain('Data Fiduciary')
    expect(t).toContain('Data Protection Board of India')
    expect(t).toMatch(/withdraw your consent/i)
    expect(t).toContain('Nominate someone')
    expect(t).toContain('grievance@waimers.in')
  })

  it('never use em or en dashes (shopper-facing text)', () => {
    for (const type of POLICY_TYPES) expect(textOf(type)).not.toMatch(/[–—]/)
  })

  it('build rich text the editor and storefront renderer understand', () => {
    const doc = fillPolicyTemplate('terms-of-service', input)
    const types = new Set(doc.root.children?.map((n) => n.type))
    expect([...types].sort()).toEqual(['heading', 'list', 'paragraph'])
    const list = doc.root.children?.find((n) => n.type === 'list')
    expect(list?.listType).toBe('bullet')
    expect(list?.children?.[0]?.type).toBe('listitem')
  })

  it('print bracketed prompts for missing details and list them', () => {
    const bare: PolicyTemplateInput = {
      ...input,
      legalName: '',
      address: emptyStoreAddress,
      email: '',
      phone: '',
      gstin: '',
      grievanceOfficer: { name: '', designation: '', email: '', phone: '' },
    }
    const t = textOf('contact-information', bare)
    expect(t).toContain('Business name: Waimers')
    expect(t).toContain('[business address]')
    expect(t).toContain('[grievance officer name]')
    expect(t).not.toContain('GSTIN')
    expect(missingTemplateDetails(bare)).toEqual([
      'address',
      'email',
      'phone',
      'grievanceOfficerName',
      'grievanceOfficerContact',
    ])
    expect(missingTemplateDetails(input)).toEqual([])
  })
})

describe('policy helpers', () => {
  it('map handles and paths', () => {
    expect(policyPath('refund-policy')).toBe('/policies/refund-policy')
    expect(policyTypeOfHandle('privacy-policy')).toBe('privacy-policy')
    expect(policyTypeOfHandle('about-us')).toBeNull()
    expect(missingRequiredPolicies(['refund-policy', 'privacy-policy'])).toEqual([
      'terms-of-service',
      'shipping-policy',
      'contact-information',
    ])
  })

  it('read the grievance officer only once a name and contact exist', () => {
    const prefs = { seo: {}, policies: { grievanceOfficer: { name: 'Asha', email: 'a@b.in' } } }
    expect(grievanceOfficerOf(prefs)?.name).toBe('Asha')
    expect(grievanceOfficerOf({ policies: { grievanceOfficer: { name: 'Asha' } } })).toBeNull()
    expect(parsePolicySettings({ policies: { legalName: 5 } }).legalName).toBe('')
  })

  it('take the fastest minimum and slowest maximum across rates', () => {
    expect(transitRange([], 3, 6)).toEqual({ minDays: 3, maxDays: 6 })
    expect(
      transitRange(
        [
          { min: 1, max: 2 },
          { min: null, max: 8 },
        ],
        3,
        6,
      ),
    ).toEqual({ minDays: 1, maxDays: 8 })
  })
})
