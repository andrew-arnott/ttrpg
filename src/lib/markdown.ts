/** A small Markdown reader for the Player's Guide: headings, paragraphs, lists and tables. */

export interface HeadingBlock {
  kind: 'heading'
  level: number
  text: string
  slug: string
}

export type Block =
  | HeadingBlock
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] }

/** `1. Core Rules` becomes `core-rules`, so links do not break when sections are renumbered. */
export function slugify(text: string): string {
  return text
    .replace(/^\d+\.\s+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())

export function parseMarkdown(source: string): Block[] {
  const lines = source.split('\n')
  const blocks: Block[] = []
  const seen = new Map<string, number>()
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '' || /^\s*<!--.*-->\s*$/.test(line)) {
      i++
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const text = heading[2].replace(/\*\*/g, '').trim()
      const base = slugify(text)
      const count = (seen.get(base) ?? 0) + 1
      seen.set(base, count)
      blocks.push({ kind: 'heading', level: heading[1].length, text, slug: count === 1 ? base : `${base}-${count}` })
      i++
      continue
    }

    if (line.trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      const header = splitRow(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(splitRow(lines[i++]))
      blocks.push({ kind: 'table', header, rows })
      continue
    }

    const bullet = /^\s*(?:[*-]|\d+\.)\s+/
    if (bullet.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: string[] = []
      while (i < lines.length && bullet.test(lines[i])) items.push(lines[i++].replace(bullet, '').trim())
      blocks.push({ kind: 'list', ordered, items })
      continue
    }

    const paragraph: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !bullet.test(lines[i]) &&
      !lines[i].trim().startsWith('|')
    ) {
      paragraph.push(lines[i++].trim())
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
  }
  return blocks
}

const headingsOf = (blocks: Block[]) => blocks.filter((b): b is HeadingBlock => b.kind === 'heading')

export function tableOfContents(blocks: Block[]): HeadingBlock[] {
  return headingsOf(blocks).filter((h) => h.level >= 2 && h.level <= 3)
}

/** A heading and everything under it, up to the next heading of the same or a higher level. */
export function sectionOf(blocks: Block[], slug: string): Block[] {
  const start = blocks.findIndex((b) => b.kind === 'heading' && b.slug === slug)
  if (start < 0) return []
  const level = (blocks[start] as HeadingBlock).level
  let end = start + 1
  while (end < blocks.length) {
    const b = blocks[end]
    if (b.kind === 'heading' && b.level <= level) break
    end++
  }
  return blocks.slice(start, end)
}

/** The top-level (second-level) section a heading belongs to. */
export function topSectionSlug(blocks: Block[], slug: string): string | null {
  let current: string | null = null
  for (const b of blocks) {
    if (b.kind !== 'heading') continue
    if (b.level === 2) current = b.slug
    if (b.slug === slug) return b.level <= 2 ? b.slug : current
  }
  return null
}

const plain = (b: Block): string =>
  b.kind === 'table' ? [...b.header, ...b.rows.flat()].join(' ') : b.kind === 'list' ? b.items.join(' ') : b.kind === 'heading' ? b.text : b.text

/** Headings whose own text, or the text directly under them, contains every word searched for. */
export function searchSections(blocks: Block[], query: string): HeadingBlock[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const hits: HeadingBlock[] = []
  let heading: HeadingBlock | null = null
  let body = ''
  const flush = () => {
    if (heading && words.every((w) => `${heading!.text} ${body}`.toLowerCase().includes(w))) hits.push(heading)
  }
  for (const b of blocks) {
    if (b.kind === 'heading') {
      flush()
      heading = b.level >= 2 ? b : null
      body = ''
    } else if (heading) body += ` ${plain(b)}`
  }
  flush()
  return hits
}
