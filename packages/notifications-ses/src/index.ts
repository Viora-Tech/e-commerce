export { cleanDisplayName, formatMailbox } from './address'
export {
  identityState,
  type SenderIdentityError,
  type SenderIdentityProvider,
  type SenderIdentityState,
  type SenderIdentityStatus,
  type SesIdentityClientLike,
  type SesIdentityConfig,
  SesIdentityProvider,
} from './identity'
export { sesPlugin } from './plugin'
export {
  formatFrom,
  SesChannel,
  type SesChannelOptions,
  type SesClientLike,
  type SesConfig,
  sesFactory,
} from './ses'
