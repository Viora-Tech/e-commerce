# Live view: globe fills the whole panel

Branch `feat/live-view-full-globe`. No migration.

- `analytics/live-view.tsx` no longer has a max-width container: the page is the full height of the
  content panel and the globe (`live-globe/live-globe-hero.tsx`) fills it edge to edge, centred
  (the old right-shift for the stats column is gone).
- The header (back link, title, summary, Pause) is a glass pill top-left; the stats card sits on the
  left edge and the activity card on the right edge on wide screens, both stacked at the bottom on
  phones (scroll inside if tall). The top-right stays free for the globe's own gear and zoom buttons.
- `webgl-globe-canvas.tsx` stops its frame loop while the tab is hidden and restarts when shown;
  reduced motion handling is unchanged.
