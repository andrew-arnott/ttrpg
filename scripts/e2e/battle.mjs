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
let sawClash = false
for (let i = 0; i < 80; i++) {
  if ((await page.locator('.clash').count()) > 0 && !sawClash) {
    sawClash = true
    await shot('clash')
    console.log('clash:', (await page.locator('.clash').innerText()).replace(/\n+/g, ' | '))
  }
  if ((await page.locator('.resolution').count()) > 0) {
    if (sawClash) await skipOverlay(page)
    else await page.waitForTimeout(500)
  } else if ((await page.getByRole('button', { name: 'No thanks' }).count()) > 0) {
    await page.getByRole('button', { name: 'No thanks' }).click()
  } else if ((await page.locator('.card-head .step-index', { hasText: 'Round 2' }).count()) > 0) {
    break
  } else {
    await page.waitForTimeout(300)
  }
}
assert.ok(sawClash, 'the enemy attack clash should be shown')
assert.match(await page.locator('.card-head .step-index', { hasText: 'Round' }).first().innerText(), /Round 2/i)

console.log('battle check passed')
await browser.close()
report(errors)
