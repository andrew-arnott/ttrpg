/** The sample warrior starts with Resolve only, so a Defend offers no Armor to commit and the result line shows none. */
import assert from 'node:assert/strict'
import { enterDungeon, launch, report, screenshotter, skipOverlay } from './lib.mjs'

const { browser, page, errors } = await launch()
const shot = screenshotter(page, 'resources')

await enterDungeon(page)
await page.getByRole('button', { name: 'Start sample battle' }).click()
await skipOverlay(page)
await page.waitForSelector('.card-head h2')
assert.match(await page.locator('.card-head h2', { hasText: 'what should they do' }).first().innerText(), /Brann/)

await page.locator('.option', { hasText: 'Defend' }).first().click()
assert.equal(await page.getByLabel(/Spend Armor/).count(), 0, 'no Armor to spend')
await shot('prompt', true)
await page.getByRole('button', { name: 'Do it' }).click()
await page.waitForSelector('.resolution-math', { timeout: 60000 })
assert.doesNotMatch(await page.locator('.resolution-math').first().innerText(), /Armor/)
await shot('result')
await skipOverlay(page)

console.log('resources check passed')
await browser.close()
report(errors)
