/** Copy shared by every provider-style settings page (Payments, Shipping, Notifications). */
export const providerSettingsContent = {
  back: 'Settings',
  save: 'Save',
  discard: 'Discard',
  unsaved: 'Unsaved changes',
  saved: 'Settings saved',
  saveFailed: 'Save failed',
  couldNotSave: 'Could not save',
  enabled: 'Enabled',
  active: 'Active',
  off: 'Off',
  noConfig: 'No configuration needed.',
  secretHelp: 'Stored encrypted. Leave the masked value to keep it.',
  required: 'Required',
  noProviders: {
    heading: 'Nothing installed yet',
    body: 'Install an app to add providers here.',
    action: 'Open Apps',
    href: '/apps/store',
  },
} as const
