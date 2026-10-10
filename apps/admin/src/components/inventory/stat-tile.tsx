import LayoutStatTile from '@/components/layout/stat-tile'

type StatTileProps = {
  title: string
  value: string
  caption: string
}

/** Inventory and purchase-order tiles: the shared Proofly stat tile with a caption under the figure. */
export default function StatTile({ title, value, caption }: StatTileProps) {
  // Render logic
  return <LayoutStatTile label={title} value={value} trendNote={caption} />
}
