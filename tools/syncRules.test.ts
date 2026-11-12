import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PROFESSIONS } from '../src/data/professions'
import { parseMarkdown, sectionOf, slugify, type Block } from '../src/lib/markdown'
import { syncReference } from './rulesReference'

const RULES_PATH = new URL('../docs/RULES.md', import.meta.url)
const doc = readFileSync(RULES_PATH, 'utf8')

/**
 * `npm run rules:sync` rewrites the generated appendix of docs/RULES.md. Without the flag this
 * only checks that it is up to date, so a change to src/data cannot leave the rules behind.
 */
describe('docs/RULES.md', () => {
  const synced = syncReference(doc)
  if (process.env.UPDATE_RULES && synced !== doc) writeFileSync(RULES_PATH, synced)

  it('has an up-to-date generated reference (run `npm run rules:sync`)', () => {
    expect(synced).toBe(process.env.UPDATE_RULES ? synced : doc)
  })

  describe('lists every ability the app has, with the same cost', () => {
    const blocks = parseMarkdown(doc)
    for (const profession of PROFESSIONS.filter((p) => p.defined)) {
      const section = sectionOf(blocks, slugify(profession.name))
      const abilities = [...(profession.passives ?? []), ...profession.abilities, ...profession.explorationAbilities]
      for (const ability of abilities) {
        it(`${profession.name}: ${ability.name}`, () => {
          const at = section.findIndex((b) => b.kind === 'heading' && b.slug === slugify(ability.name))
          expect(at, 'heading in the rules').toBeGreaterThan(-1)
          const next: Block | undefined = section[at + 1]
          const line = (b: Block | undefined) => (b?.kind === 'paragraph' ? b.text : '')
          const header = [section[at + 1], section[at + 2]].map(line).find((t) => t.startsWith('**') && / — |^\*\*[A-Za-z +]+\*\*$/.test(t))
          const expected = ability.cost === '—' ? ability.types.join(' + ') : `${ability.types.join(' + ')} — ${ability.cost}`
          expect(header?.replace(/\*\*/g, ''), `type and cost line after ${ability.name}${next ? '' : ''}`).toBe(expected)
        })
      }
    }
  })
})
