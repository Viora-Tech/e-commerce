import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* Previous, next, Download, Edit image and More; preview and link; details, alt text and used in. */
export default function Loading() {
  return <DetailPageSkeleton actions={5} main={2} side={3} />
}
