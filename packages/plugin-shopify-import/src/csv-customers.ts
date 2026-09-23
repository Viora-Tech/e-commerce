/**
 * Shopify customer CSV → NCustomer. Reads both the current export
 * (`Default Address Address1`, `Accepts Email Marketing`) and the older one
 * (`Address1`, `Accepts Marketing`).
 */
import { bool, cleanId, hasColumn, readTable, tags } from './csv'
import type { Issue, NAddress, NCustomer } from './types'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseCustomersCsv(text: string): { customers: NCustomer[]; issues: Issue[] } {
  const table = readTable(text)
  const issues: Issue[] = []
  if (!hasColumn(table, 'email')) {
    return {
      customers: [],
      issues: [
        {
          resource: 'customers',
          row: 1,
          message: 'No Email column. In Shopify, export Customers as CSV.',
        },
      ],
    }
  }
  const customers: NCustomer[] = []
  for (const row of table.rows) {
    const rawEmail = row.get('email').toLowerCase()
    const email = rawEmail && EMAIL.test(rawEmail) ? rawEmail : null
    const phone = row.get('phone', 'default address phone') || null
    const first = row.get('first name') || null
    const last = row.get('last name') || null
    if (rawEmail && !email) {
      issues.push({
        resource: 'customers',
        row: row.line,
        ref: rawEmail,
        message: 'Email is not valid',
      })
    }
    if (!email && !phone) {
      issues.push({
        resource: 'customers',
        row: row.line,
        ref: [first, last].filter(Boolean).join(' ') || null,
        message: 'Customer has no email or phone; skipped',
      })
      continue
    }
    const line1 = row.get('default address address1', 'address1')
    const name = [first, last].filter(Boolean).join(' ')
    const address: NAddress | null = line1
      ? {
          name,
          company: row.get('default address company', 'company') || null,
          line1,
          line2: row.get('default address address2', 'address2') || null,
          city: row.get('default address city', 'city'),
          province: row.get('province') || null,
          provinceCode: row.get('default address province code', 'province code') || null,
          country: row.get('country') || null,
          countryCode: row.get('default address country code', 'country code') || null,
          zip: row.get('default address zip', 'zip').replace(/^'/, ''),
          phone: row.get('default address phone') || phone,
        }
      : null
    customers.push({
      sourceId: cleanId(row.get('customer id', 'id')),
      email,
      phone,
      firstName: first,
      lastName: last,
      acceptsMarketing: bool(row.get('accepts email marketing', 'accepts marketing'), false),
      acceptsSmsMarketing: bool(row.get('accepts sms marketing'), false),
      tags: tags(row.get('tags')),
      note: row.get('note') || null,
      address,
      createdAt: null,
      row: row.line,
    })
  }
  return { customers, issues }
}
