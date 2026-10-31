/** Copy for the AI features: "Write with AI" on a product and Settings → AI. The AI bar's copy is in `assistant.ts`. Plain words, no jargon. */

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

  settings: {
    title: 'AI',
    subtitle:
      'Your AI assistant on every page, and product writing from your photos. Included in your plan.',
    off: {
      title: 'AI is not switched on yet',
      body: 'AI features need to be set up on this platform first. Your other settings are not affected.',
    },
    usage: {
      heading: 'This month',
      help: (resetsOn: string) => `Your allowance starts again on ${resetsOn}.`,
      plan: 'Plan',
      plans: {
        free: 'Free',
        starter: 'Starter',
        growth: 'Growth',
        pro: 'Pro',
        scale: 'Scale',
        internal: 'Unlimited',
      },
      credits: 'AI credits',
      creditsHelp:
        'Each answer or write uses a few credits, depending on how much the AI reads and writes.',
      extra: (n: string) => `+ ${n} bought credits left (used after this month's)`,
      buy: (price: string) => `Buy 1,000 credits · ${price}`,
      buyFailed: 'Could not start the payment. Try again.',
      words: 'AI reading and writing',
      wordsHelp: 'Measured in tokens: about four characters each.',
      of: (used: string, limit: string) => `${used} of ${limit}`,
      byFeature: 'By feature',
      /** Times a feature was used this month; the allowance itself is in credits (#114). */
      requestCount: (n: number) => (n === 1 ? 'Used once' : `Used ${n} times`),
    },
    features: {
      heading: 'AI features',
      help: 'Turn a feature off to hide its button for everyone in your store.',
      productWriter: {
        label: 'Write with AI',
        help: 'On the product page: description, search text, tags and key specs from your photos.',
      },
      assistant: {
        label: 'AI assistant',
        help: 'The AI bar on every page: answers from your own data, and changes you approve first.',
      },
      bulkWriter: {
        label: 'Write with AI for many products',
        help: 'On the products list: select products and write them all at once, then review.',
      },
      documentReader: {
        label: 'Read bills with AI',
        help: 'On purchase orders and inbound shipments: reads supplier invoices and Bills of Entry for you to check and apply.',
      },
    },
    quality: {
      label: 'Writing quality',
      help: 'Best uses a stronger AI for product writing. Each write then uses about 3 times the credits.',
      standard: 'Standard',
      best: 'Best',
    },
    privacy: {
      heading: 'Your data',
      lines: [
        "Customer phone numbers, emails and addresses are never sent to the AI. To draft a reply, it sees only the customer's first name, and says so.",
        'Text in your products and orders is treated as data, never as instructions to the AI.',
        'Nothing changes in your store until you approve it. Every change is listed under Activity, with Undo where possible.',
        'Conversations are not saved on our servers. We count how much AI you use.',
      ],
      model: (fast: string, strong: string) =>
        `Models: ${fast} (chat and quick writing), ${strong} (Best writing)`,
    },
    save: 'Save',
    saved: 'AI settings saved',
    failed: 'Could not save AI settings',
    loadFailed: 'Could not load AI settings. Refresh to try again.',
  },
} as const
