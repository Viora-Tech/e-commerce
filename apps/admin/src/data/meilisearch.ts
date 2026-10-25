/** Copy for the Meilisearch app's page: connection, search index status and synonyms. Plain words. */
export const meilisearchContent = {
  title: 'Meilisearch',
  subtitle: 'Fast store search that forgives typos. Shoppers find “t-shrit” and “tee” alike.',
  save: 'Save',
  discard: 'Discard',
  unsaved: 'Unsaved changes',
  saved: 'Saved',
  failed: 'Could not save. Try again.',
  status: {
    live: 'Live. Your store’s search and the search box suggestions use Meilisearch.',
    connect: 'Not connected yet. Add your Meilisearch address and admin key below.',
    index: 'Connected. Run Reindex now once, and search switches to Meilisearch when it finishes.',
    fallback:
      'If Meilisearch is down or slow, your store’s built-in search answers instead, so search never breaks.',
  },
  connect: {
    title: 'Connect Meilisearch',
    description:
      'Meilisearch is a free, open-source search engine. Run it on your own server or use Meilisearch Cloud.',
    host: {
      label: 'Meilisearch address',
      help: 'Where your Meilisearch answers, for example https://search.yourstore.in.',
      placeholder: 'https://search.yourstore.in',
    },
    adminKey: {
      label: 'Admin key',
      help: 'The master key, or the “Default Admin API Key” from GET /keys. Kept encrypted and never shown again.',
      placeholder: 'Paste the key',
      saved: 'A key is saved. Paste a new one to replace it.',
      remove: 'Remove key',
      removed: 'Admin key removed',
    },
    test: 'Test connection',
    testOk: (version: string) => `Connected to Meilisearch ${version}`,
    noSearchKey:
      'This key cannot create a search-only key, so searches use the admin key on our server. Use the master key once to create one.',
    searchKey: 'A search-only key is in place for shoppers’ searches.',
  },
  index: {
    title: 'Search index',
    description: 'Products are copied to Meilisearch when you add or change them.',
    documents: 'Products in search',
    lastSync: 'Last update',
    never: 'Never',
    reindex: 'Reindex now',
    reindexing: 'Reindexing… This page updates when you open it again.',
    queued: 'Reindex started',
    indexingNow: 'Meilisearch is still applying changes.',
    unknown: 'Unknown',
    error: 'Last problem',
    count: (n: string) => `${n} products`,
  },
  synonyms: {
    title: 'Synonyms',
    description:
      'Words that mean the same thing to your shoppers. One group per line, words split by commas.',
    label: 'Synonym groups',
    placeholder: 'tee, t-shirt, tshirt\nkurta, kurti\nmobile, phone',
    help: (max: number) =>
      `Up to ${max} groups. A search for any word in a group finds the others.`,
    save: 'Save synonyms',
    saved: 'Synonyms saved',
  },
  credit: 'Meilisearch is open source (MIT licence), made by Meili SAS.',
} as const
