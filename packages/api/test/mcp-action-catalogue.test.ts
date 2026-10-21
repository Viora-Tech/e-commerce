import { describe, expect, it } from 'vitest'
import {
  apiTokenRefusal,
  areaOf,
  classifyAction,
  exclusionReason,
  humanName,
  kindForInput,
  procedureAt,
  routerProcedures,
} from '../src/mcp/action-catalogue'
import { appRouter } from '../src/routers/_app'

/*
 * Which admin procedures MCP clients may reach, and how each is treated (read / write /
 * sensitive / excluded). A new router namespace must be given an area or excluded here.
 */

describe('MCP action catalogue', () => {
  it('reads by verb, writes by default, and the explicit tables win', () => {
    expect(classifyAction('orders.list')).toBe('read')
    expect(classifyAction('store.getGeneral')).toBe('read')
    expect(classifyAction('shipments.quote')).toBe('read')
    expect(classifyAction('shipments.label')).toBe('read')
    expect(classifyAction('payments.setup')).toBe('read')
    expect(classifyAction('staff.members')).toBe('read')
    expect(classifyAction('orders.fulfil')).toBe('write')
    expect(classifyAction('products.save')).toBe('write')
    expect(classifyAction('products.somethingNew')).toBe('write')
    // "getaway" is not "get" + a word.
    expect(classifyAction('products.getaway')).toBe('write')
  })

  it('marks refunds, cancellations, deletes, keys, people, billing, domains and MCP settings sensitive', () => {
    for (const path of [
      'orders.refund',
      'returns.refund',
      'returns.storeCredit',
      'orders.cancelShipment',
      'purchaseOrders.cancel',
      'discounts.delete',
      'customers.deleteAddress',
      'purchaseCharges.remove',
      'customerPrivacy.anonymise',
      'apps.uninstall',
      'payments.connect',
      'payments.saveMethods',
      'store.updatePayments',
      'staff.invite',
      'staff.saveRole',
      'billing.choose',
      'domains.connect',
      'storeData.deleteStore',
      'apiAccess.saveSettings',
      'giftCards.adjust',
    ])
      expect([path, classifyAction(path)]).toEqual([path, 'sensitive'])
  })

  it('turns some writes sensitive for their input', () => {
    expect(kindForInput('orders.setStatus', { id: 'x', status: 'fulfilled' })).toBe('write')
    expect(kindForInput('orders.setStatus', { id: 'x', status: 'cancelled' })).toBe('sensitive')
    expect(kindForInput('products.bulk', { ids: [], action: { kind: 'addTag' } })).toBe('write')
    expect(kindForInput('products.bulk', { ids: [], action: { kind: 'delete' } })).toBe('sensitive')
  })

  it('excludes sign-in, tokens, approvals, platform and cross-store procedures', () => {
    for (const path of [
      'me',
      'account.sessions',
      'account.revokeSession',
      'account.deleteAccount',
      'apiAccess.createToken',
      'apiAccess.revoke',
      'ai.approveAction',
      'ai.undoAction',
      'onboarding.create',
      'invitations.accept',
      'bugReports.create',
      'payments.razorpayOAuthStart',
    ]) {
      expect([path, classifyAction(path)]).toEqual([path, null])
      expect(exclusionReason(path)).toBeTruthy()
    }
  })

  it('gives every router namespace an area or a reason, and counts the catalogue', () => {
    const all = routerProcedures(appRouter)
    const unmapped = [
      ...new Set(
        all
          .filter(
            (p) => !areaOf(p.path) && exclusionReason(p.path) === 'no MCP & API area covers it yet',
          )
          .map((p) => p.path.split('.')[0]),
      ),
    ]
    expect(unmapped).toEqual([])
    const counts = { read: 0, write: 0, sensitive: 0, excluded: 0 }
    for (const p of all) counts[classifyAction(p.path) ?? 'excluded'] += 1
    expect(counts.read + counts.write + counts.sensitive).toBeGreaterThan(500)
    console.info(`[mcp-actions] ${all.length} procedures`, counts)
  })

  it('finds procedures by path, never through prototype keys', () => {
    expect(procedureAt(appRouter, 'orders.fulfil')).not.toBeNull()
    expect(procedureAt(appRouter, 'orders')).toBeNull()
    expect(procedureAt(appRouter, '__proto__.toString')).toBeNull()
    expect(procedureAt(appRouter, 'orders.constructor')).toBeNull()
  })

  it('refuses access tokens what only a person may do', () => {
    expect(apiTokenRefusal('products.list')).toBeNull()
    expect(apiTokenRefusal('discounts.delete')).toBeNull()
    expect(apiTokenRefusal('payments.connect')).toBeTruthy()
    expect(apiTokenRefusal('apiAccess.createToken')).toBeTruthy()
    expect(apiTokenRefusal('ai.approveAction')).toBeTruthy()
  })

  it('names actions for people', () => {
    expect(humanName('purchaseOrders.markOrdered')).toBe('Purchase orders: mark ordered')
    expect(humanName('marketing.campaigns.schedule')).toBe('Marketing campaigns: schedule')
  })
})
