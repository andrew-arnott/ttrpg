import { characterArtUrl } from '../lib/art'

interface Props {
  professionId: string | null | undefined
  portrait?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

/** A character's picture: the portrait they chose or uploaded, falling back to their profession. */
export function CharacterPortrait({ professionId, portrait, size = 'md', className = '' }: Props) {
  const src = characterArtUrl(professionId, portrait)
  if (!src) return null
  return (
    <img
      className={`portrait ${size} ${className}`.trim()}
      src={src}
      alt=""
      width={256}
      height={256}
      draggable={false}
    />
  )
}
