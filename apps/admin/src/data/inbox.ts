/** Copy for the Inbox sales channel: settings, quick replies and blocked senders. */
export const inboxContent = {
  channel: 'Inbox',
  failed: 'Something went wrong. Try again.',
  notInstalled: {
    heading: 'Inbox is not installed',
    body: 'Install Inbox to chat with shoppers on your store. It is free on every plan.',
    action: 'Install Inbox',
  },
  settings: {
    title: 'Inbox settings',
    subtitle: 'How the chat looks and behaves on your store.',
    saved: 'Settings saved',
    unsaved: 'Unsaved changes',
    save: 'Save',
    discard: 'Discard',
    chat: {
      title: 'Chat on your store',
      greeting: {
        label: 'Greeting',
        help: 'The first line shoppers see when they open the chat. Leave it blank for “Hi! How can we help?”.',
        placeholder: 'Hi! How can we help?',
      },
      sound: {
        label: 'Sound for new replies',
        help: 'A short sound in the shopper’s browser when you reply.',
      },
    },
    availability: {
      title: 'When you are online',
      help: (zone: string) =>
        `Shoppers see whether someone is around. Times are in your store’s time zone (${zone}).`,
      label: 'Availability',
      options: {
        always: 'Always online',
        hours: 'During business hours',
        offline: 'Always away',
      },
      hours: 'Business hours',
      closed: 'Closed',
      open: 'Open',
      from: 'From',
      to: 'To',
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      away: {
        label: 'Away message',
        help: 'Shown while nobody is online. Leave it blank for “We’re away right now. Leave a message and we’ll reply here.”.',
        placeholder: 'We’re away right now. Leave a message and we’ll reply here.',
      },
    },
    contact: {
      title: 'Shopper details',
      capture: {
        label: 'Ask for an email or phone',
        help: 'So you can reach shoppers who leave before you reply.',
        options: {
          off: 'Don’t ask',
          optional: 'Ask, but let them skip',
          required_when_away: 'Require it while you are away',
        },
      },
      signIn: {
        label: 'Require sign-in to chat',
        help: 'Off: guests can chat. On: shoppers sign in first, so you always know who you are talking to.',
      },
    },
    email: {
      title: 'Email',
      fallback: {
        label: 'Email when you have not replied',
        help: 'If nobody replies in this many minutes and the shopper left an email, they get an email saying you will answer. 0 turns it off.',
        suffix: 'minutes',
      },
    },
    ai: {
      title: 'AI agent',
      description:
        'Answers shoppers from your products, policies and the notes below. It hands the chat to your team when it is not sure, when someone asks for a person, or for refunds and order problems. It stops as soon as you reply.',
      mode: {
        label: 'When the AI answers',
        options: {
          off: 'Off',
          away: 'Only while you are away',
          all: 'Every chat, until your team replies',
        },
      },
      knowledge: {
        label: 'What the AI should know',
        help: 'Delivery times, sizing, COD, returns: anything not on your product pages. The AI never makes up prices, stock or dates.',
        placeholder:
          'We ship in 2 to 4 days. COD is available up to ₹5,000. Sizes run true to fit.',
        count: (n: number, max: number) => `${n} / ${max}`,
      },
      learn: {
        label: 'Learn from your team’s replies',
        help: 'The AI reads how your team answered similar questions before and answers the same way. Notes are never used.',
      },
      usage: 'Each answer uses your plan’s AI allowance.',
    },
    privacy: {
      title: 'Privacy',
      retention: {
        label: 'Keep conversations for',
        help: 'Conversations with no new message for this long are deleted.',
        suffix: 'months',
      },
    },
  },
  blocks: {
    title: 'Blocked senders',
    description: 'Messages from these browsers, emails and addresses never reach your inbox.',
    empty: 'Nobody is blocked.',
    columns: { sender: 'Sender', reason: 'Reason', until: 'Blocked' },
    kinds: { visitor: 'Browser', email: 'Email', ip: 'Internet address' } as Record<string, string>,
    reasons: { spam: 'Spam filter', staff: 'Blocked by your team' } as Record<string, string>,
    unknown: 'Unknown shopper',
    expires: (when: string) => `Until ${when}`,
    forever: 'Until you unblock',
    unblock: 'Unblock',
    unblocked: 'Unblocked',
  },
  quickReplies: {
    title: 'Quick replies',
    subtitle: 'Saved answers you insert by typing / and the shortcut in a chat.',
    add: 'Add quick reply',
    edit: 'Edit',
    delete: 'Delete',
    moveUp: 'Move up',
    moveDown: 'Move down',
    empty: 'No quick replies yet. Save the answers you type every day: sizes, COD, delivery time.',
    listTitle: 'Your quick replies',
    columns: { shortcut: 'Shortcut', title: 'Title', body: 'Message' },
    saved: 'Quick reply saved',
    deleted: 'Quick reply deleted',
    dialog: {
      addTitle: 'Add a quick reply',
      editTitle: 'Edit quick reply',
      title: 'Title',
      titlePlaceholder: 'Delivery time',
      shortcut: 'Shortcut',
      shortcutHelp: 'Letters, numbers, - and _. Type /shortcut in a chat to insert it.',
      body: 'Message',
      bodyPlaceholder: 'Orders reach most cities in 3 to 5 days.',
      add: 'Add',
      save: 'Save',
      invalid: 'Fill in the title, a shortcut and the message.',
    },
    confirmDelete: {
      title: 'Delete this quick reply?',
      body: 'It is removed for everyone on your team.',
      confirm: 'Delete',
    },
  },
}
