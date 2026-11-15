import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import { SETTINGS_SKELETON_ROWS } from '@/components/settings/settings-skeleton-rows'

export default function Loading() {
  return <SectionPageSkeleton rows={SETTINGS_SKELETON_ROWS.notifications} />
}
