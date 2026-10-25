/** What a shopper reads on the cash on delivery confirm page (COD & RTO app). Plain words on purpose. */
export const codConfirmContent = {
  title: 'Confirm your order',
  ask: (n: number, total: string, items: number) =>
    `You chose cash on delivery for order #${n}: ${items} ${items === 1 ? 'item' : 'items'}, ${total} to pay at the door. Is this order yours?`,
  confirm: 'Yes, confirm my order',
  cancel: 'No, cancel this order',
  cancelHelp: 'Only cancel if you did not mean to place it. Nothing is charged.',
  confirmed: (n: number) => `Thank you. Order #${n} is confirmed and will be packed soon.`,
  cancelled: (n: number) => `Order #${n} is cancelled. You will not be charged.`,
  shipped:
    'This order has already been sent, so it can not be cancelled here. Please contact the shop.',
  invalid: 'This link is not valid any more. If you need help with an order, contact the shop.',
  home: 'Continue shopping',
} as const
