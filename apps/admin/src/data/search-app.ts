/** Copy for the Search & discovery app: the built-in search's synonyms. Plain words. */
export const searchAppContent = {
  title: 'Search & discovery',
  subtitle:
    'Your store’s search already forgives typos: “keybord” finds keyboards. Add words that mean the same thing so shoppers find what they mean.',
  synonyms: {
    title: 'Synonyms',
    description:
      'Words that mean the same thing to your shoppers. One group per line, words split by commas.',
    label: 'Synonym groups',
    placeholder: 'kb, keyboard\nmouse pad, mousepad, desk mat\ntee, t-shirt, tshirt',
    help: (max: number) =>
      `Up to ${max} groups. A search for any word in a group also finds the others.`,
    save: 'Save synonyms',
    saved: 'Synonyms saved',
  },
  failed: 'Could not save. Try again.',
} as const
