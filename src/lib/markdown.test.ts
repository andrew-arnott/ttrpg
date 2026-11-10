import { describe, expect, it } from 'vitest'
import { RULES_LINKS } from '../data/rulesLinks'
import { parseMarkdown, searchSections, sectionOf, slugify, tableOfContents, topSectionSlug } from './markdown'
import { GUIDE_BLOCKS } from './rulesGuide'

const sample = `# Title

## 1. First Part

Some **bold** text
on two lines.

### Detail

* one
* two

1. step
2. step

| A | B |
| ----- | ----- |
| 1 | 2 |

## 2. Second Part

### Detail

Again.
`

describe('markdown', () => {
  it('slugifies headings without their numbers', () => {
    expect(slugify('1. Core Rules')).toBe('core-rules')
    expect(slugify('Starting Combat and Surprise')).toBe('starting-combat-and-surprise')
    expect(slugify("Thieves' Tools")).toBe('thieves-tools')
  })

  it('reads headings, joined paragraphs, lists and tables', () => {
    const blocks = parseMarkdown(sample)
    expect(blocks.map((b) => b.kind)).toEqual([
      'heading', 'heading', 'paragraph', 'heading', 'list', 'list', 'table', 'heading', 'heading', 'paragraph',
    ])
    expect(blocks[2]).toMatchObject({ text: 'Some **bold** text on two lines.' })
    expect(blocks[4]).toMatchObject({ ordered: false, items: ['one', 'two'] })
    expect(blocks[5]).toMatchObject({ ordered: true })
    expect(blocks[6]).toMatchObject({ header: ['A', 'B'], rows: [['1', '2']] })
  })

  it('keeps repeated headings apart', () => {
    const slugs = tableOfContents(parseMarkdown(sample)).map((h) => h.slug)
    expect(slugs).toEqual(['first-part', 'detail', 'second-part', 'detail-2'])
  })

  it('takes a section up to the next heading of its level or higher', () => {
    const blocks = parseMarkdown(sample)
    expect(sectionOf(blocks, 'first-part')).toHaveLength(6)
    expect(sectionOf(blocks, 'detail')).toHaveLength(4)
    expect(sectionOf(blocks, 'nope')).toEqual([])
    expect(topSectionSlug(blocks, 'detail-2')).toBe('second-part')
  })

  it('finds sections containing every word searched for', () => {
    const blocks = parseMarkdown(sample)
    expect(searchSections(blocks, 'bold two').map((h) => h.slug)).toEqual(['first-part'])
    expect(searchSections(blocks, 'again').map((h) => h.slug)).toEqual(['detail-2'])
    expect(searchSections(blocks, '')).toEqual([])
  })
})

describe('the Player’s Guide as browsed', () => {
  const slugs = new Set(GUIDE_BLOCKS.flatMap((b) => (b.kind === 'heading' ? [b.slug] : [])))

  it('has a section for every tutorial link', () => {
    for (const slug of Object.values(RULES_LINKS)) expect(slugs.has(slug), `link ${slug}`).toBe(true)
  })

  it('has fifteen top-level sections, with tables and lists kept intact', () => {
    expect(GUIDE_BLOCKS.filter((b) => b.kind === 'heading' && b.level === 2)).toHaveLength(15)
    expect(GUIDE_BLOCKS.some((b) => b.kind === 'table' && b.header[0] === 'Attribute')).toBe(true)
    const combat = sectionOf(GUIDE_BLOCKS, 'combat')
    expect(combat.some((b) => b.kind === 'list')).toBe(true)
  })

  it('finds the engagement rules by search', () => {
    expect(searchSections(GUIDE_BLOCKS, 'disengage').map((h) => h.slug)).toContain('engagement')
  })
})
