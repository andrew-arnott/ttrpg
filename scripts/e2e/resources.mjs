/** Commits Armor to a Defend from the sample warrior and checks the prompt and the result line. */
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
const armor = page.getByLabel(/Spend Armor/)
await armor.selectOption('2')
await shot('prompt', true)
await page.getByRole('button', { name: 'Do it' }).click()
await page.waitForSelector('.resolution-math', { timeout: 60000 })
assert.match(await page.locator('.resolution-math').first().innerText(), /Armor 2/)
await shot('result')
await skipOverlay(page)

console.log('resources check passed')
await browser.close()
report(errors)
