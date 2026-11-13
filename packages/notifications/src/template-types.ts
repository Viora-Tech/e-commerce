import type { TemplateId } from './types'

/** A template on the provider's account with its review status, whatever that status is. */
export type ChannelTemplateStatus = {
  name: string
  language: string
  /** APPROVED, PENDING, REJECTED, PAUSED, DISABLED, IN_APPEAL… as the provider says it. */
  status: string
  category: string
  /** Why the provider turned it down, when it says. */
  rejectedReason?: string | undefined
}

/**
 * What a store must have approved for one message to go out on a template channel: the template
 * name the sender uses, its category, the body with `{{1}}`-style placeholders in the order the
 * sender fills them, and an example value for each (the provider asks for examples on review).
 */
export type ChannelTemplateSpec = {
  id: TemplateId
  name: string
  category: 'UTILITY' | 'AUTHENTICATION'
  body: string
  examples: string[]
}
