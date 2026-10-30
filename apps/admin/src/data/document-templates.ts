/** Copy for Settings › Printed documents (the template editor) and the orders print view. */
export const documentTemplatesContent = {
  title: 'Printed documents',
  meta: 'What prints when you print from Orders. Each one is a template with merge tags filled from the order.',
  kinds: {
    packing_slip: {
      name: 'Packing slip',
      body: 'Goes in the parcel: the order, the address and what is inside, no prices.',
    },
    pick_list: {
      name: 'Pick list',
      body: 'For the warehouse: every item across the selected orders, with how many to pick.',
    },
    invoice: {
      name: 'Invoice',
      body: 'A simple invoice with prices and totals, for stores without the GST invoices app.',
    },
  },
  custom: 'Edited',
  standard: 'Default',
  edit: 'Edit',
  back: 'Printed documents',
  gstApp: {
    title: 'Your GST invoices app makes the tax invoice',
    body: 'It keeps the invoice GST compliant, so only its branding (logo, colours, wording) and which fields show can change. Change them in the app.',
    open: 'Open GST invoice settings',
  },
  editor: {
    html: 'Template (HTML)',
    htmlHelp:
      'Plain HTML and a <style> tag. Scripts do not run. Merge tags: {{ order.number }} prints a value; {{#lines}} … {{/lines}} repeats for each item; {{^order.note}} … {{/order.note}} shows when it is empty.',
    tags: 'Merge tags',
    preview: 'Preview',
    previewHelp: 'A made-up order, with your store’s details.',
    reset: 'Reset to default',
    resetTitle: 'Reset this template?',
    resetBody: 'Your changes go and the default template comes back. You cannot undo this.',
    resetConfirm: 'Reset',
    cancel: 'Cancel',
    saveMessage: 'Unsaved template changes',
    save: 'Save',
    discard: 'Discard',
    saved: 'Template saved',
    resetDone: 'Template reset to default',
    failed: 'Could not save the template',
    tooLong: 'The template is too long.',
  },
  print: {
    titles: {
      packing_slip: 'Packing slips',
      pick_list: 'Pick list',
      invoice: 'Invoices',
    },
    frame: 'Document to print',
    gstApp:
      'Tax invoices come from the GST invoices app. Print them from its queue, or from each order.',
  },
}
