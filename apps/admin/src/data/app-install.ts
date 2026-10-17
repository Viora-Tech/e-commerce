/** Copy for the install flow (Figma "Connect step 1 — account", "2 — permissions", "3 — done"). */
export const appInstallContent = {
  steps: { connect: 'Connect account', permissions: 'Permissions', done: 'Done' },
  close: 'Close',
  connect: {
    title: (name: string) => `Connect ${name}`,
    intro: (name: string) =>
      `Paste your account details from ${name}. Nothing is booked or charged while testing.`,
    test: 'Test connection',
    testing: 'Testing…',
    testHint: (name: string) => `Checks that ${name} accepts these details.`,
    testFailed: 'Could not test the connection',
    cancel: 'Cancel',
    continue: 'Continue',
    loadFailed: 'Could not load the account fields. Try again in a minute.',
  },
  permissions: {
    title: (name: string) => `Install ${name}?`,
    intro: 'Here is what this app will be able to do in your store.',
    heading: 'This app will',
    access: 'What it can access',
    back: 'Back',
    cancel: 'Cancel',
    install: 'Install',
    failed: 'Could not install the app',
  },
  done: {
    title: (name: string) => `${name} is ready`,
    connected: 'Your account works and is saved.',
    builtin: 'Installed and ready to use.',
    needsSetup: 'Installed. Connect your account to start using it.',
    close: 'Close',
    openApp: 'Open app',
    connect: 'Connect account',
  },
  /** `/apps/install?app=<id>` with an id this deployment does not ship. */
  unknownApp: 'That app is not available in this store.',
  installedToast: (name: string) => `${name} installed`,
} as const
