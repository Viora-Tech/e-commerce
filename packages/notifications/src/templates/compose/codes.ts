import type { TemplateData, TemplateId } from '../../types'
import { blockCopy } from '../content-blocks'
import type { Composer } from './index'
import { muted, present } from './order'

/**
 * Batch 2, one-time codes: the digits large and unbroken with how long they work, then what to
 * do if the shopper did not ask. The Copy code button waits on a storefront copy page, so the
 * block draws without it for now.
 */
const c = () => blockCopy.codes

const codeBlock = (d: TemplateData) =>
  d.code ? ({ kind: 'code', code: d.code, expires: c().expires } as const) : null

const loginCode: Composer = (d) => ({
  eyebrow: c().loginKicker(d.storeName),
  lead: c().loginLead,
  blocks: present([
    codeBlock(d),
    d.actionUrl ? { kind: 'divider', label: c().orSkip } : null,
    d.actionUrl ? { kind: 'button', label: c().oneTap, url: d.actionUrl } : null,
    muted(c().loginIgnore),
  ]),
})

const deletionCode: Composer = (d) => ({
  eyebrow: c().deleteKicker,
  heading: c().deleteHeading,
  lead: c().deleteLead,
  blocks: present([
    codeBlock(d),
    { kind: 'notice', tone: 'bad', title: c().deleteWarning, body: c().deleteWarningBody },
    muted(c().deleteIgnore),
  ]),
})

const emailChangeCode: Composer = (d) => ({
  eyebrow: c().changeKicker,
  heading: c().changeHeading,
  lead: c().changeLead,
  blocks: present([codeBlock(d), muted(c().changeNote(d.storeName))]),
})

export const codeComposers: Partial<Record<TemplateId, Composer>> = {
  login_code: loginCode,
  account_deletion_code: deletionCode,
  email_change_code: emailChangeCode,
}
