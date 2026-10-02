/** Copy for the AI features: "Write with AI", "Ask your store" and Settings → AI. Plain words, no jargon. */

export const aiContent = {
  badge: 'AI',
  disclaimer: 'AI can make mistakes. Check it before you rely on it.',

  writer: {
    button: 'Write with AI',
    title: 'Write with AI',
    subtitle: 'Uses your photos and product name. Nothing changes until you click Apply.',
    notesLabel: 'Anything to mention? (optional)',
    notesPlaceholder: 'Materials, size, who it is for, what is in the box…',
    toneLabel: 'Tone',
    tones: {
      friendly: 'Friendly',
      premium: 'Premium',
      playful: 'Playful',
      technical: 'Technical',
      simple: 'Simple',
    },
    languageLabel: 'Language',
    languages: { en: 'English', hi: 'Hindi' },
    photos: (n: number) => {
      const used = Math.min(n, 3)
      if (used === 0) return 'No photos yet. Add a few first for a much better description.'
      return used === 1
        ? 'It will look at your photo.'
        : `It will look at your first ${used} photos.`
    },
    optionsSummary: (tone: string, language: string) => `${tone} tone, in ${language}`,
    change: 'Change',
    needTitle: 'Add a product name first, so the writer knows what this is.',
    generate: 'Write it',
    regenerate: 'Write again',
    working: 'Writing…',
    workingHint: 'Looking at your photos and notes. This takes a few seconds.',
    resultHeading: 'Pick what to use',
    resultHint: 'Tick the parts you like. Apply puts them in the form, then you save as usual.',
    now: 'Now',
    suggested: 'Suggested',
    empty: 'Empty',
    fields: {
      description: 'Description',
      specs: 'Key specs',
      seoTitle: 'Search title',
      seoDescription: 'Search description',
      tags: 'Tags',
    },
    specsHint: 'Added at the end of the description.',
    tagsHint: (n: number) =>
      n === 1 ? '1 new tag, added to yours' : `${n} new tags, added to yours`,
    noNewTags: 'No new tags',
    noSpecs: 'No specs found in the photos or notes.',
    apply: 'Apply to product',
    applied: 'Added to the form. Check it, then save.',
    nothingPicked: 'Tick at least one part to apply.',
    cancel: 'Cancel',
    failed: 'Could not write this time. Please try again.',
  },

  ask: {
    title: 'Ask your store',
    subtitle: 'Sales, stock and orders, answered from your own data.',
    placeholder: 'Ask about sales, stock or orders…',
    send: 'Ask',
    stop: 'Stop',
    suggestions: [
      'How were sales this week?',
      "What's running out?",
      'Orders waiting over 2 days?',
      'Top products this month?',
      'Abandoned checkouts this week?',
    ],
    thinking: 'Checking your store…',
    checking: (what: string) => `Checking ${what}…`,
    sourcesTitle: 'Numbers from your store',
    sourcesToggle: (n: number) => (n === 1 ? 'Show the data used' : `Show the data used (${n})`),
    sourcesHide: 'Hide the data used',
    tools: {
      salesSummary: 'sales',
      topProducts: 'top products',
      lowStock: 'stock',
      pendingOrders: 'orders to ship',
      abandonedCheckouts: 'abandoned checkouts',
    } as Record<string, string>,
    stopped: 'Stopped.',
    failed: 'Sorry, that did not work. Please try again.',
    newQuestion: 'Clear',
  },

  settings: {
    title: 'AI',
    subtitle: 'Write product pages and ask about your store with AI. Included in your plan.',
    off: {
      title: 'AI is not switched on yet',
      body: 'AI features need to be set up on this platform first. Your other settings are not affected.',
    },
    usage: {
      heading: 'This month',
      help: (resetsOn: string) => `Your allowance starts again on ${resetsOn}.`,
      plan: 'Plan',
      plans: { free: 'Free', starter: 'Starter', growth: 'Growth', unlimited: 'Unlimited' },
      requests: 'AI requests',
      words: 'AI reading and writing',
      wordsHelp: 'Measured in tokens: about four characters each.',
      of: (used: string, limit: string) => `${used} of ${limit}`,
      unlimited: (used: string) => `${used} used, no limit`,
      byFeature: 'By feature',
      requestCount: (n: number) => (n === 1 ? '1 request' : `${n} requests`),
    },
    features: {
      heading: 'AI features',
      help: 'Turn a feature off to hide its button for everyone in your store.',
      productWriter: {
        label: 'Write with AI',
        help: 'On the product page: description, search text, tags and key specs from your photos.',
      },
      askStore: {
        label: 'Ask your store',
        help: 'On Home: questions about sales, stock and orders, answered from your own data.',
      },
    },
    privacy: {
      heading: 'Your data',
      lines: [
        'Customer names, phone numbers, emails and addresses are never sent to the AI.',
        'Questions and answers are not saved. We only count how much AI you use.',
        'Nothing is changed in your store until you click Apply and save.',
      ],
      model: (model: string) => `Model: ${model}`,
    },
    save: 'Save',
    saved: 'AI settings saved',
    failed: 'Could not save AI settings',
    loadFailed: 'Could not load AI settings. Refresh to try again.',
  },
} as const
