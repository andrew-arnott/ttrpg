import { ENEMIES, type EnemyAttack } from '../src/data/enemies'
import { HOLY_TORCH, ITEMS, ORDINARY_TORCH, STARTING_COINS } from '../src/data/items'
import { RANGED_CLOSE_PENALTY, HAND_ITEMS, TWO_HANDED_DAMAGE } from '../src/data/weapons'
import { TOKENS } from '../src/data/tokens'
import { SPECIAL_LABELS } from '../src/data/types'

export const REFERENCE_START = '<!-- reference:start -->'
export const REFERENCE_END = '<!-- reference:end -->'

const table = (header: string[], rows: string[][]) =>
  [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')

const attackText = (a: EnemyAttack) =>
  `**${a.name}**: attack ${a.attackValue}, damage ${a.damage}${a.area ? ', hits the whole room' : ''}${
    a.condition ? `, adds ${TOKENS[a.condition]?.name ?? a.condition}` : ''
  }`

function handItems(): string {
  const rows = HAND_ITEMS.map((i) => [
    i.name,
    String(i.cost),
    String(i.hands),
    i.kind === 'shield' ? 'none' : SPECIAL_LABELS[i.attribute!],
    i.description,
  ])
  return [
    `Each character has two hand slots, Main Hand and Off Hand. A two-handed weapon does ${TWO_HANDED_DAMAGE} extra damage. A ranged weapon can attack enemies you are not engaged with, and is at ${RANGED_CLOSE_PENALTY} against ones you are.`,
    table(['Item', 'Coins', 'Hands', 'Attacks test', 'Notes'], rows),
  ].join('\n\n')
}

function consumables(): string {
  const rows = ITEMS.map((i) => [i.name, String(i.cost), i.description])
  return table(['Item', 'Coins', 'Effect'], rows)
}

function torches(): string {
  const row = (t: typeof ORDINARY_TORCH) => [t.name, String(t.bright), String(t.steady), String(t.dim)]
  return table(['Torch', 'Bright', 'Steady', 'Dim'], [row(ORDINARY_TORCH), row(HOLY_TORCH)])
}

function bestiary(): string {
  const rows = ENEMIES.map((e) => [
    e.name,
    String(e.hp),
    String(e.defense),
    String(e.noticeDifficulty),
    e.attacks.map(attackText).join('; '),
    [
      ...e.triggers.map((t) => `**${t.name}**: ${t.text}`),
      e.startsEngagedWithAll ? 'Starts engaged with everyone.' : '',
      e.pullsEveryoneIn ? 'Pulls everyone back into its group at the end of its turn.' : '',
    ]
      .filter(Boolean)
      .join(' '),
  ])
  return table(['Enemy', 'HP', 'Defense', 'Notice', 'Attacks', 'Notes'], rows)
}

/** The appendix of this rules file that comes from the app's data. */
export function renderReference(): string {
  return [
    REFERENCE_START,
    '## 15. Reference',
    `These tables are generated from the app's data by \`npm run rules:sync\`. Do not edit them by hand; change \`src/data\` instead.`,
    '### Hands and Weapons',
    handItems(),
    '### Starting Equipment',
    `Characters start with ${STARTING_COINS} coins.`,
    consumables(),
    '### Torch Burn Times',
    `Intervals spent at each light level before the torch goes out.`,
    torches(),
    '### Tutorial Bestiary',
    `Enemies have no token bag and make no tests. Notice is the Perception Difficulty to spot the enemy before it strikes.`,
    bestiary(),
    REFERENCE_END,
  ].join('\n\n')
}

/** The rules text with its generated appendix replaced by a fresh one. */
export function syncReference(doc: string): string {
  const start = doc.indexOf(REFERENCE_START)
  const end = doc.indexOf(REFERENCE_END)
  const fresh = renderReference()
  if (start < 0 || end < 0) return `${doc.trimEnd()}\n\n${fresh}\n`
  return `${doc.slice(0, start)}${fresh}${doc.slice(end + REFERENCE_END.length)}`
}
