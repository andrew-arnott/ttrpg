import { ITEM_ART_ID } from '../data/items'
import { artUrl, type ArtKind } from '../lib/art'

interface PortraitProps {
  kind: ArtKind
  id: string | null | undefined
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Portrait({ kind, id, size = 'md', className = '' }: PortraitProps) {
  if (!id) return null
  const artId = kind === 'item' ? (ITEM_ART_ID[id] ?? id) : id
  const src = artUrl(kind, artId)
  if (!src) return null
  return (
    <img
      className={`portrait ${size} ${className}`.trim()}
      src={src}
      alt=""
      width={256}
      height={256}
      loading="lazy"
      draggable={false}
    />
  )
}
