/** The theme editor's App embeds panel: the Inbox app's "Online store chat" embed. */
export const customizeInboxEmbedContent = {
  label: 'Online store chat',
  app: 'Inbox',
  description:
    'The chat button shoppers use to message you. These settings belong to the Inbox app, so they save as you change them, not with the theme.',
  greeting: 'Greeting message',
  greetingPlaceholder: 'Hi, how can we help?',
  manage: 'Manage app',
  preview: 'Preview',
  previewChat: 'Chat',
  saving: 'Saving…',
  saved: 'Saved',
  failed: 'Could not save the chat settings. Try again.',
  loadFailed: 'Could not load the chat settings.',
  themeColour: 'Use theme colour',
  pickProducts: 'Choose products',
  pickedProducts: (n: number) =>
    n === 0 ? 'Your two best sellers' : `${n} ${n === 1 ? 'product' : 'products'} chosen`,
}
