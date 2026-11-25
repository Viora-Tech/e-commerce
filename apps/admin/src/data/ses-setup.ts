/**
 * Apps → Amazon SES email → Connect: the check that runs after Save (keys, sending on, sandbox,
 * From verified, configuration set) and the bounces-and-complaints setup for a store's own account.
 */

type Issue =
  | 'bad_keys'
  | 'no_permission'
  | 'unreachable'
  | 'sending_paused'
  | 'sandbox'
  | 'from_not_verified'
  | 'config_set_missing'

export const sesSetupContent = {
  check: {
    title: 'Connection check',
    checking: 'Checking with Amazon…',
    notSaved: 'Save your Amazon SES details, then the connection is checked here.',
    ready: 'Amazon SES is ready to send your emails.',
    readyWithLimit: 'Amazon SES works, with a limit:',
    blocked: 'Emails will not go out until this is fixed:',
    failed: 'Could not check the connection. Try again in a minute.',
    again: 'Check again',
    issues: {
      bad_keys: 'Amazon refused the access key or secret. Copy both again from IAM and save.',
      no_permission:
        'This access key cannot read your SES settings. Give its IAM user SES access (ses:Get* and ses:SendEmail).',
      unreachable:
        'Amazon SES did not answer in that region. Check the region code, for example ap-south-1.',
      sending_paused: 'Amazon has paused sending on this account. Open SES in AWS to see why.',
      sandbox:
        'Sandbox: until Amazon gives production access, emails only reach addresses you verified. Ask for production access in SES.',
      from_not_verified:
        'The From address (or its domain) is not verified in this region. Verify it in SES, Identities.',
      config_set_missing: 'There is no configuration set with that name in this region.',
    } satisfies Record<Issue, string>,
  },
  bounces: {
    title: 'Bounces and complaints',
    body: 'So the shop stops emailing addresses that bounce or mark it as spam: in SES, create a configuration set with an event destination for bounces and complaints to an SNS topic. Subscribe the address below to that topic (HTTPS), then enter the configuration set and the topic ARN above and save.',
    urlLabel: 'Subscription address for the SNS topic',
  },
}
