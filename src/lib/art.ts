const modules = import.meta.glob('../assets/art/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export type ArtKind = 'profession' | 'species' | 'bg' | 'item' | 'enemy'

/** Stand-ins until a character or creature has art of its own. */
const STAND_INS: Partial<Record<ArtKind, Record<string, string>>> = {
  enemy: { colossus: 'skeleton' },
}

export function artUrl(kind: ArtKind, id: string): string | undefined {
  return modules[`../assets/art/${kind}-${id}.webp`] ?? modules[`../assets/art/${kind}-${STAND_INS[kind]?.[id]}.webp`]
}
