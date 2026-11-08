/** Picks Change engagement in the sample battle and checks the rules popup and the Difficulty preview. */
import assert from 'node:assert/strict'
import { enterDungeon, launch, report, screenshotter, skipOverlay } from './lib.mjs'

const { browser, page, errors } = await launch()
const shot = screenshotter(page, 'engage')

await enterDungeon(page)
await page.getByRole('button', { name: 'Start sample battle' }).click()
await skipOverlay(page)
await page.waitForSelector('.card-head h2')

await page.locator('.option', { hasText: 'Change engagement' }).click()
const dialog = page.getByRole('dialog')
await dialog.waitFor()
assert.match(await dialog.innerText(), /Difficulty starts at 4/)
await shot('popup')
await page.getByRole('button', { name: 'Got it' }).click()
await dialog.waitFor({ state: 'detached' })

assert.match(await page.locator('.prompt-rule').innerText(), /Difficulty: 4 base/)
await shot('preview', true)

await page.locator('.option', { hasText: 'Defend' }).first().click()
await page.locator('.option', { hasText: 'Change engagement' }).click()
assert.equal(await page.getByRole('dialog').count(), 0, 'the popup only opens the first time')
await page.getByRole('button', { name: 'How does this work?' }).click()
await page.getByRole('dialog').waitFor()

console.log('engage check passed')
await browser.close()
report(errors)
