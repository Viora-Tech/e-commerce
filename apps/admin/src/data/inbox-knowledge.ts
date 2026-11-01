/** Copy for Inbox › Knowledge base: the answers the AI agent quotes, and taking over a chat from the AI. */
export const inboxKnowledgeContent = {
  failed: 'Something went wrong. Try again.',
  title: 'Knowledge base',
  subtitle:
    'Short answers the AI agent gives shoppers: shipping time, warranty, returns, COD. Only published answers are used.',
  publishedOf: (published: number, total: number) => `${published} of ${total} published`,
  add: 'Add answer',
  edit: 'Edit',
  delete: 'Delete',
  moveUp: 'Move up',
  moveDown: 'Move down',
  listTitle: 'Your answers',
  empty:
    'No answers yet. Add the questions shoppers ask every day, so the AI can answer them the way you would.',
  columns: { title: 'Question', answer: 'Answer', published: 'Published' },
  publish: (title: string) => `Publish "${title}"`,
  imported: 'From Shopify',
  saved: 'Answer saved',
  deleted: 'Answer deleted',
  publishedOn: 'Published. The AI can use it now.',
  publishedOff: 'Unpublished. The AI no longer uses it.',
  aiOff: 'The AI agent is off, so shoppers do not see these answers yet.',
  aiSettings: 'Turn on the AI agent',
  bringOver: {
    title: 'Knowledge Base Facts from Shopify',
    body: (remaining: number, total: number) =>
      remaining === total
        ? `Your Shopify import brought ${total} Knowledge Base Facts. Copy them here so the AI can use them.`
        : `${remaining} of the ${total} imported Knowledge Base Facts are not here yet.`,
    note: 'Answers you confirmed in Shopify keep their published setting. Answers Shopify only suggested come over unpublished, for you to check.',
    action: 'Bring them over',
    done: (added: number) =>
      added === 0 ? 'Nothing new to bring over' : `Brought over ${added} answers`,
  },
  dialog: {
    addTitle: 'Add an answer',
    editTitle: 'Edit answer',
    title: 'Question or topic',
    titlePlaceholder: 'How long does shipping take?',
    answer: 'Answer',
    answerPlaceholder: 'Orders ship in 1 to 2 days and reach most cities in 3 to 5 days.',
    answerHelp:
      'Write it the way you would tell a shopper. The AI quotes it and does not add to it.',
    published: 'Published',
    publishedHelp: 'The AI uses only published answers.',
    add: 'Add',
    save: 'Save',
    invalid: 'Fill in the question and the answer.',
  },
  confirmDelete: {
    title: 'Delete this answer?',
    body: 'The AI stops using it straight away.',
    confirm: 'Delete',
  },
  takeOver: {
    title: 'The AI agent is answering this chat',
    hint: 'Take over to answer yourself. Replying also takes over.',
    action: 'Take over',
    done: 'You took over. The AI stays quiet in this chat.',
  },
}
