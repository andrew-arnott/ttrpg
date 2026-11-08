/**
 * Plays the whole tutorial dungeon through the real UI with a simple bot: open the door, break the
 * Founders' Seal, win (or lose) the fights, and reach the tutorial-complete card.
 *
 * The bot always takes the suggested battle action, so it can lose; that is reported as "party fell"
 * with exit code 2 and is not an app failure. Any other stall, or a console error, exits with 1.
 */
import { enterDungeon, launch, report, SAMPLE_PARTY, screenshotter, skipOverlay } from './lib.mjs'

const { browser, page, errors } = await launch()
const shot = screenshotter(page, 'tutorial')
const MAX_STEPS = 600

await enterDungeon(page)
await shot('start', true)

/** Interaction to attempt in each room, in the order the bot visits them. */
const SEAL_TASKS = [
  { room: 'shrine', action: 'interact:braziers' },
  { room: 'library', action: 'interact:scrolls' },
  { room: 'cistern', action: 'interact:stone' },
]

const ROOM_NAMES = {
  entrance: 'Entrance Hall',
  greatHall: 'Great Hall',
  barracks: 'Watch Room',
  storeroom: 'Storeroom',
  library: 'Reliquary Library',
  shrine: 'Shrine of Embers',
  cistern: 'Flooded Cistern',
  crypt: 'Founders\u2019 Crypt',
}
const EXITS = {
  entrance: ['greatHall'],
  greatHall: ['entrance', 'barracks', 'storeroom', 'shrine'],
  barracks: ['greatHall', 'library'],
  storeroom: ['greatHall', 'cistern'],
  library: ['barracks', 'shrine'],
  cistern: ['storeroom', 'shrine'],
  shrine: ['greatHall', 'library', 'cistern', 'crypt'],
  crypt: ['shrine'],
}
const idByName = Object.fromEntries(Object.entries(ROOM_NAMES).map(([id, name]) => [name, id]))

function firstStep(from, to) {
  const queue = [[from, []]]
  const seen = new Set([from])
  while (queue.length) {
    const [room, path] = queue.shift()
    if (room === to) return path[0]
    for (const next of EXITS[room]) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push([next, [...path, next]])
      }
    }
  }
  return undefined
}

const actionSelect = (name) => page.getByLabel(`Action for ${name}`)
const hasOption = async (name, value) =>
  (await actionSelect(name).locator(`option[value="${value}"]:not([disabled])`).count()) > 0
const goalDone = async (pattern) => (await page.locator('.checklist li.done', { hasText: pattern }).count()) > 0

async function currentRoom() {
  const heading = page
    .locator('.card-head', { has: page.locator('.step-index', { hasText: /Sunken Crypt/i }) })
    .locator('h2')
    .first()
  return idByName[await heading.innerText()]
}

async function resolveInterval() {
  await page.getByRole('button', { name: 'Resolve Interval' }).click()
}

/** Everyone tries `action` where they can, and keeps watch otherwise. */
async function everyone(action) {
  for (const name of SAMPLE_PARTY) {
    const choice = (await hasOption(name, action)) ? action : 'watch'
    await actionSelect(name).selectOption(choice)
  }
}

async function relightTorchIfNeeded() {
  const level = await page.locator('.torch-level').innerText().catch(() => '')
  if (/Out|Dim/i.test(level) && (await page.locator('.inv-slot.torch').count()) > 0) {
    await page.locator('.inv-slot.torch').first().click({ button: 'right' })
  }
}

async function healBeforeBoss() {
  for (const name of SAMPLE_PARTY) {
    for (const item of ['use:healingPotion', 'use:bandage']) {
      if (await hasOption(name, item)) {
        for (const other of SAMPLE_PARTY) {
          await actionSelect(other).selectOption(other === name ? item : 'watch')
        }
        await resolveInterval()
        return true
      }
    }
  }
  return false
}

let taskIndex = 0
let outcome = 'stalled'

for (let step = 0; step < MAX_STEPS; step++) {
  if ((await page.locator('.resolution').count()) > 0) {
    const text = await page.locator('.resolution').innerText()
    if (/Battle begins/i.test(text)) await shot('battle-opening')
    if (/Complication!/.test(text)) await shot('complication')
    await skipOverlay(page)
    continue
  }

  if ((await page.locator('.engagement-group').count()) > 0) {
    if ((await page.getByRole('button', { name: 'Finish tutorial' }).count()) > 0) {
      await shot('congratulations', true)
      await page.getByRole('button', { name: 'Finish tutorial' }).click()
    } else if ((await page.getByRole('button', { name: 'Continue exploring' }).count()) > 0) {
      await shot('patrol-victory', true)
      await page.getByRole('button', { name: 'Continue exploring' }).click()
    } else if ((await page.getByText('The party has fallen').count()) > 0) {
      await shot('party-fell', true)
      outcome = 'party fell'
      break
    } else {
      await page.getByRole('button', { name: /^(Do it|Use it)/ }).click()
    }
    continue
  }

  if ((await page.locator('.card.completion').count()) > 0 && (await page.locator('.checklist li.done').count()) === 3) {
    await shot('complete', true)
    outcome = 'completed'
    break
  }

  await relightTorchIfNeeded()
  const room = await currentRoom()

  if (!(await goalDone(/iron door/i))) {
    await shot('door', true)
    await actionSelect('Brann Ironhold').selectOption('unlock:entranceDoor:break')
    await actionSelect('Wren Quickfingers').selectOption('unlock:entranceDoor:pick')
    await actionSelect('Sister Maren').selectOption('watch')
    await actionSelect('Ilvara Dawnleaf').selectOption('watch')
    await resolveInterval()
    continue
  }

  const sealBroken = await goalDone(/Seal/i)
  if (!sealBroken) {
    const task = SEAL_TASKS[taskIndex % SEAL_TASKS.length]
    if (room === task.room) {
      if (!(await hasOption('Brann Ironhold', task.action))) {
        taskIndex += 1
        continue
      }
      await everyone(task.action)
      await resolveInterval()
      continue
    }
    await shot(`route-${room}`, true)
    await page.locator('.exit-buttons .btn', { hasText: ROOM_NAMES[firstStep(room, task.room)] }).first().click()
    continue
  }

  if (room === 'shrine' && (await healBeforeBoss())) continue
  const hop = firstStep(room, 'crypt')
  if (!hop) break
  await shot('seal-broken', true)
  await page.locator('.exit-buttons .btn', { hasText: ROOM_NAMES[hop] }).first().click()
}

console.log('outcome:', outcome)
await browser.close()
report(errors)
if (outcome === 'party fell') process.exitCode = 2
else if (outcome !== 'completed') process.exitCode = 1
