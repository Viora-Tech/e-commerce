/** Copy for login and the store picker. */
export const authContent = {
  login: {
    title: 'Log in',
    subtitle: 'Use the email your store invited.',
    email: 'Email',
    emailHelp: 'We will email you a one-time code.',
    continue: 'Continue with email',
    code: (email: string) => `Code sent to ${email}`,
    codeHelp: 'In development the code is printed in the admin server log.',
    submit: 'Log in',
    differentEmail: 'Use a different email',
    sendFailed: 'Could not send the code',
    wrongCode: 'Wrong code',
  },
  selectStore: {
    title: 'Choose a store',
    open: (name: string) => `Open ${name}`,
    empty: {
      heading: 'No stores yet',
      body: 'Store creation lands with onboarding. Ask an owner to invite you.',
    },
    switchFailed: 'Could not switch stores. Try again.',
    opening: 'Opening your store…',
  },
} as const
