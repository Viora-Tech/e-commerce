/** The fictional Asha Handlooms catalogue the docs screenshots are taken from. */
export type Item = {
  handle: string
  title: string
  type: string
  price: number
  mrp?: number
  hsn: string
  gst: number
  colours: [string, string][]
  sizes?: string[]
  tags: string[]
}

/** [name, hex] pairs: the first colour of each item also paints its photo. */
export const ITEMS: Item[] = [
  {
    handle: 'indigo-handloom-kurta',
    title: 'Indigo handloom cotton kurta',
    type: 'Kurta',
    price: 1499,
    mrp: 1999,
    hsn: '6211',
    gst: 5,
    colours: [
      ['Indigo', '#2b3a67'],
      ['Rust', '#b4532a'],
    ],
    sizes: ['S', 'M', 'L'],
    tags: ['cotton', 'bestseller'],
  },
  {
    handle: 'kantha-stitch-throw',
    title: 'Kantha stitch throw',
    type: 'Home',
    price: 2499,
    hsn: '6304',
    gst: 18,
    colours: [['Marigold', '#d99a2b']],
    tags: ['home'],
  },
  {
    handle: 'banarasi-silk-saree',
    title: 'Banarasi silk saree',
    type: 'Saree',
    price: 6800,
    mrp: 7900,
    hsn: '5007',
    gst: 5,
    colours: [
      ['Wine', '#7a1f3d'],
      ['Emerald', '#1f6b52'],
    ],
    tags: ['silk', 'festive'],
  },
  {
    handle: 'chanderi-cotton-dupatta',
    title: 'Chanderi cotton dupatta',
    type: 'Dupatta',
    price: 1150,
    hsn: '6214',
    gst: 5,
    colours: [
      ['Ivory', '#e9dfc8'],
      ['Peach', '#e8a586'],
    ],
    tags: ['cotton'],
  },
  {
    handle: 'ikat-cotton-shirt',
    title: 'Ikat cotton shirt',
    type: 'Shirt',
    price: 2199,
    mrp: 2499,
    hsn: '6205',
    gst: 5,
    colours: [['Teal', '#22616b']],
    sizes: ['M', 'L', 'XL'],
    tags: ['cotton', 'men'],
  },
  {
    handle: 'block-print-bedsheet-set',
    title: 'Block-print cotton bedsheet set',
    type: 'Home',
    price: 1899,
    hsn: '6302',
    gst: 5,
    colours: [['Sky', '#5b8db8']],
    tags: ['home', 'bestseller'],
  },
  {
    handle: 'khadi-cotton-tote',
    title: 'Khadi cotton tote',
    type: 'Bag',
    price: 650,
    hsn: '4202',
    gst: 12,
    colours: [['Natural', '#cbb994']],
    tags: ['cotton'],
  },
  {
    handle: 'pashmina-blend-shawl',
    title: 'Pashmina-blend shawl',
    type: 'Shawl',
    price: 4500,
    mrp: 5200,
    hsn: '6214',
    gst: 5,
    colours: [
      ['Charcoal', '#3c3c40'],
      ['Camel', '#a87b4f'],
    ],
    tags: ['wool', 'winter'],
  },
  {
    handle: 'kalamkari-table-runner',
    title: 'Kalamkari table runner',
    type: 'Home',
    price: 899,
    hsn: '6304',
    gst: 5,
    colours: [['Madder', '#9c3b2f']],
    tags: ['home'],
  },
  {
    handle: 'mulmul-cotton-stole',
    title: 'Mulmul cotton stole',
    type: 'Stole',
    price: 799,
    hsn: '6214',
    gst: 5,
    colours: [
      ['Sage', '#8fa98b'],
      ['Blush', '#e3b7b0'],
    ],
    tags: ['cotton'],
  },
  {
    handle: 'handwoven-jute-rug',
    title: 'Handwoven jute rug',
    type: 'Home',
    price: 3200,
    hsn: '5702',
    gst: 5,
    colours: [['Jute', '#b08d57']],
    tags: ['home'],
  },
  {
    handle: 'handloom-towel-set',
    title: 'Handloom cotton towel set',
    type: 'Home',
    price: 1250,
    hsn: '6302',
    gst: 5,
    colours: [['Sand', '#d9c6a5']],
    tags: ['home', 'cotton'],
  },
]

export const COLLECTIONS = [
  { handle: 'sarees-and-dupattas', title: 'Sarees and dupattas', types: ['Saree', 'Dupatta'] },
  { handle: 'home-linen', title: 'Home linen', types: ['Home'] },
  { handle: 'everyday-cotton', title: 'Everyday cotton', types: ['Kurta', 'Shirt', 'Stole'] },
]
