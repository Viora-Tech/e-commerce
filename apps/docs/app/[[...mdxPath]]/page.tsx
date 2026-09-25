import { generateStaticParamsFor, importPage } from 'nextra/pages'
import PageFeedback from '../../components/page-feedback'
import ReadingTime from '../../components/reading-time'
import { useMDXComponents as getMDXComponents } from '../../mdx-components'

type PageProps = {
  params: Promise<{ mdxPath?: string[] }>
}

export const generateStaticParams = generateStaticParamsFor('mdxPath')

export async function generateMetadata(props: PageProps) {
  const params = await props.params
  const { metadata } = await importPage(params.mdxPath)
  return metadata
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const result = await importPage(params.mdxPath)
  const { default: MDXContent, toc, metadata } = result
  const Wrapper = getMDXComponents().wrapper as NonNullable<
    ReturnType<typeof getMDXComponents>['wrapper']
  >
  const readingMinutes = (metadata as { readingTime?: { minutes?: number } }).readingTime?.minutes
  return (
    <Wrapper toc={toc} metadata={metadata}>
      {params.mdxPath && <ReadingTime minutes={readingMinutes} />}
      <MDXContent {...props} params={params} />
      {params.mdxPath && <PageFeedback />}
    </Wrapper>
  )
}
