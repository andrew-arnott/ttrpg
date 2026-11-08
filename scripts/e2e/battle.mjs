/**
 * Starts the sample battle from the dungeon header, checks the enemy stat card, and plays the first
 * enemy phase far enough to see the Attack versus Defense clash.
 */
import assert from 'node:assert/strict'
import { enterDungeon, launch, report, screenshotter, skipOverlay } from './lib.mjs'

const { browser, page, errors } = await launch()
const shot = screenshotter(page, 'battle')

await enterDungeon(page)
await page.getByRole('button', { name: 'Start sample battle' }).click()
await skipOverlay(page)
await page.waitForSelector('.engagement-group')

await page.locator('.combatant.enemy').first().hover()
await page.waitForSelector('.statcard', { state: 'visible' })
assert.match(await page.locator('.statcard:visible').innerText(), /Attacks, after the players act/i)
await shot('statcard', true)
await page.mouse.move(5, 5)

assert.match(
  await page.locator('.card-head h2', { hasText: 'what should they do' }).first().innerText(),
  /action 1 of 2/,
)
await shot('prompt', true)

for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'End turn' }).click()
await page.waitForSelector('.resolution')
await page.waitForSelector('.clash', { timeout: 60000 })
await shot('clash')
console.log('clash:', (await page.locator('.clash').innerText()).replace(/\n+/g, ' | '))

await skipOverlay(page)
assert.match(await page.locator('.card-head .step-index', { hasText: 'Round' }).first().innerText(), /Round 2/i)

console.log('battle check passed')
await browser.close()
report(errors)
