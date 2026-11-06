const modules = import.meta.glob('../assets/art/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export type ArtKind = 'profession' | 'species' | 'bg' | 'item'

export function artUrl(kind: ArtKind, id: string): string | undefined {
  return modules[`../assets/art/${kind}-${id}.webp`]
}
