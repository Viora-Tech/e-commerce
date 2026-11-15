import { diagramCopy } from '../data/guides'

type DiagramProps = {
  /** File name under `public/diagrams/`, without the extension. */
  name: string
  /** What the picture shows, for screen readers and search. */
  alt: string
  caption?: string
}

/**
 * An Excalidraw diagram: `public/diagrams/<name>.svg` in the light theme and `<name>.dark.svg`
 * in the dark one (both drawn from `<name>.excalidraw` by `scripts/render-diagrams.mjs`), with a
 * link to the editable source. Opens full size in a new tab when clicked.
 */
export default function Diagram({ name, alt, caption }: DiagramProps) {
  const light = `/diagrams/${name}.svg`
  const dark = `/diagrams/${name}.dark.svg`
  const source = `/diagrams/${name}.excalidraw`

  return (
    <figure className="mt-6 flex flex-col gap-2">
      <a
        href={light}
        target="_blank"
        rel="noreferrer"
        className="block overflow-x-auto rounded-xl border border-(--docs-border) [.dark_&]:hidden"
      >
        <img src={light} alt={alt} loading="lazy" className="h-auto w-full min-w-[40rem]" />
      </a>
      <a
        href={dark}
        target="_blank"
        rel="noreferrer"
        className="hidden overflow-x-auto rounded-xl border border-(--docs-border) [.dark_&]:block"
      >
        <img src={dark} alt={alt} loading="lazy" className="h-auto w-full min-w-[40rem]" />
      </a>
      <figcaption className="text-center text-[0.8125rem] leading-relaxed text-(--docs-muted)">
        {caption ? `${caption} ` : ''}
        <span data-pagefind-ignore="all">
          {diagramCopy.editBefore}
          <a href={source} download className="underline">
            {name}.excalidraw
          </a>
          {diagramCopy.editAfter}
        </span>
      </figcaption>
    </figure>
  )
}
