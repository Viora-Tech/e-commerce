type EyebrowProps = { children: string; dot?: boolean }

export default function Eyebrow({ children, dot = true }: EyebrowProps) {
  return (
    <p className="inline-flex items-center gap-2 text-eyebrow">
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-foreground" /> : null}
      {children}
    </p>
  )
}
