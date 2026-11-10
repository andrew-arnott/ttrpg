const modules = import.meta.glob('../assets/art/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export type ArtKind = 'profession' | 'portrait' | 'species' | 'bg' | 'item' | 'enemy'

export function artUrl(kind: ArtKind, id: string): string | undefined {
  return modules[`../assets/art/${kind}-${id}.webp`]
}

/** Built-in portraits are `<profession>-<number>`; anything else a character carries is an uploaded image. */
export const isBuiltInPortrait = (portrait: string | null | undefined): boolean =>
  Boolean(portrait && /^[a-z]+-\d$/.test(portrait))

export const isUploadedPortrait = (portrait: string | null | undefined): boolean =>
  Boolean(portrait?.startsWith('data:image/'))

/** The picture for a character: their upload, their chosen portrait, the first portrait for their profession, or its symbol. */
export function characterArtUrl(professionId: string | null | undefined, portrait: string | null | undefined): string | undefined {
  if (portrait && isUploadedPortrait(portrait)) return portrait
  const id = portrait && isBuiltInPortrait(portrait) ? portrait : professionId ? `${professionId}-1` : undefined
  return (id ? artUrl('portrait', id) : undefined) ?? (professionId ? artUrl('profession', professionId) : undefined)
}
