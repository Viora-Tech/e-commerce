/** Copy for the shared live-orders globe (the Home card and the Live view hero) and its
 *  zoom controls. */
export const liveGlobeContent = {
  heroTitle: 'Orders around the world',
  heroUnsupported: 'Your browser cannot draw the 3-D globe, so here is the order list instead.',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomReset: 'Reset zoom',
  credit: 'Made with Natural Earth',
} as const

/** Copy for the Live view globe's "Globe settings" panel (`globe-settings-panel.tsx`). Saved
 * per person in this browser, not shared with the rest of the store. */
export const globeSettingsContent = {
  openSettings: 'Globe settings',
  title: 'Globe settings',
  subtitle: 'Saved on this device only.',
  reset: 'Reset to default',

  layers: {
    heading: 'Layers',
    borders: 'Country borders',
    coastlines: 'Coastlines',
    grid: 'Grid lines',
    arcs: 'Order arcs',
    glow: 'Glow',
  },

  motion: {
    heading: 'Motion',
    autoRotate: 'Auto-rotate',
    speed: 'Speed',
    speeds: { slow: 'Slow', normal: 'Normal', fast: 'Fast' } as const,
    startView: 'Start view',
    startViews: {
      india: 'India',
      mine: 'My location',
      world: 'Whole world',
    } as const,
    rememberZoom: 'Remember last zoom',
    locationDenied: "Couldn't get your location, so we're showing India instead.",
  },

  look: {
    heading: 'Look',
    style: 'Style',
    styles: { solid: 'Solid land', dotted: 'Dotted' } as const,
    borderStyle: 'Border style',
    borderStyles: { solid: 'Solid', dotted: 'Dashed' } as const,
    borderStyleOff: 'Turn on Country borders to see this.',
    theme: 'Colours',
    themes: {
      accent: 'Store accent',
      night: 'Night',
      ocean: 'Ocean blue',
      mono: 'Mono',
    } as const,
    customLand: 'Land colour',
    customOcean: 'Ocean colour',
    customAccent: 'Accent colour',
    useTheme: 'Use theme colour',
  },

  data: {
    heading: 'Data',
    timeRange: 'Time range',
    timeRanges: { '1h': '1 hour', '24h': '24 hours', '7d': '7 days' } as const,
    highlightBigOrders: 'Highlight big orders',
    highlightBigOrdersHelp: 'Bigger markers for bigger orders, with a glow on the largest.',
    dayNightShadow: 'Day/night shadow',
    dayNightShadowHelp: 'Shade the side of the globe where it is currently night.',
    visitorsUnavailable:
      "We don't record where visitors browse from yet, so this globe can only show orders.",
  },
} as const
