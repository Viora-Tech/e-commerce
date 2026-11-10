/** Copy for the products list's "Set weight and box" (bulk). */
export const productBulkShippingContent = {
  menu: 'Set weight and box',
  title: 'Set weight and box',
  help: (n: number) =>
    `For every variant of the ${n} selected product${n === 1 ? '' : 's'}. Leave a field empty to keep what each variant has.`,
  weight: 'Product weight (g)',
  weightHelp:
    "The product in its retail box. Don't add the packing: it comes from the box you pick below.",
  box: 'Box',
  keepBox: 'Keep each variant’s box',
  noBox: 'No box (main box)',
  boxSize: (name: string, l: number, w: number, h: number, packing: number) =>
    `${name} · ${l} × ${w} × ${h} cm · ${packing} g packing`,
  option: 'Only variants with this option (optional)',
  optionPlaceholder: 'XL',
  optionHelp: 'Like XL or Alu. Only variants with exactly that option get the weight and box.',
  cancel: 'Cancel',
  apply: 'Apply',
  nothing: 'Enter a weight or pick a box.',
  done: (n: number) => `${n} variant${n === 1 ? '' : 's'} updated`,
  noneMatched: 'No variant has that option. Nothing changed.',
  failed: 'Could not update the products',
}
