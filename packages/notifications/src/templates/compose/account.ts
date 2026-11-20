import type { TemplateId } from '../../types'
import { templateContent } from '../content'
import { blockCopy2 } from '../content-blocks-2'
import type { Composer } from './index'
import { button, muted, present } from './order'

/**
 * Batch 7, account: one button and a quiet line about what to do if the shopper did not ask.
 * The email-changed notice to the old address says how to act if it was not them.
 */
const c = () => blockCopy2.account

const signInLink: Composer = (d, action) => ({
  eyebrow: c().signInKicker(d.storeName),
  blocks: present([
    button(action),
    action ? muted(c().pasteLink(action.url)) : null,
    muted(c().notYou),
  ]),
})

const newsletter: Composer = (d, action) => ({
  eyebrow: c().newsletterKicker(d.storeName),
  blocks: present([button(action, c().signMeUp), muted(c().didNotSignUp)]),
})

const emailChanged: Composer = (d) => ({
  eyebrow: c().securityKicker,
  lead: d.emailChange ? c().nowSignIn(d.emailChange.newEmail) : undefined,
  blocks: [
    { kind: 'status', tone: 'accent', title: c().noMoreCodes },
    // Platform mail: the copy's own line says whom to tell (the store owner or support).
    {
      kind: 'notice',
      tone: 'bad',
      title: c().notYouTitle,
      body: templateContent.email_changed.outro(d),
    },
  ],
})

export const accountComposers: Partial<Record<TemplateId, Composer>> = {
  login_link: signInLink,
  newsletter_confirm: newsletter,
  email_changed: emailChanged,
}
