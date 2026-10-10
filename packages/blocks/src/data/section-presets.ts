/**
 * Names of the section styles offered when a section is added (`../section-presets.ts`): what
 * each looks like, in plain words. English; the admin shows them as they are.
 */
export const sectionPresetsContent = {
  Hero: {
    slideshow: { label: 'Slideshow', description: 'Two slides that turn by themselves' },
    centred: { label: 'Centred', description: 'One big picture, words in the middle' },
    split: { label: 'Split', description: 'Words on one side, picture on the other' },
    video: { label: 'Video', description: 'A looping video behind your words' },
  },
  FeatureCards: {
    three: { label: '3 across', description: 'Cards with icons, three in a row' },
    four: { label: '4 across', description: 'Four smaller cards in a row' },
    two: { label: '2 across', description: 'Two wide cards in a row' },
    text: { label: 'Text only', description: 'No icons, just titles and words' },
  },
  ImageBanner: {
    centred: { label: 'Centred', description: 'Words in the middle of the picture' },
    left: { label: 'Left', description: 'Words on the left of the picture' },
    tall: { label: 'Tall', description: 'A taller picture, words in the middle' },
  },
  ImageWithText: {
    imageLeft: { label: 'Picture left', description: 'Picture first, words on the right' },
    imageRight: { label: 'Picture right', description: 'Words first, picture on the right' },
  },
  FeatureChecklist: {
    imageLeft: { label: 'Picture left', description: 'Picture on the left of the list' },
    imageRight: { label: 'Picture right', description: 'Picture on the right of the list' },
  },
} as const
