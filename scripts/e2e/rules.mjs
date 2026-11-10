/** Browses the rules tab, searches it, and opens a rules popup from the tutorial without leaving the dungeon. */
import assert from 'node:assert/strict'
import { enterDungeon, launch, report, screenshotter } from './lib.mjs'

const { browser, page, errors } = await launch()
const shot = screenshotter(page, 'rules')

await enterDungeon(page)
assert.ok(await page.locator('.tutorial-intro').count() === 0, 'already in the dungeon')

await page.goto(`${page.url().split('#')[0]}#/rules`)
await page.getByRole('navigation', { name: 'Rules contents' }).waitFor()
await shot('start', true)

await page.getByRole('navigation', { name: 'Rules contents' }).getByRole('link', { name: /Combat/ }).click()
await page.locator('#rules-engagement').waitFor()
assert.match(await page.locator('main').innerText(), /Changing engagement only takes a test/)
await shot('combat', true)

await page.getByPlaceholder(/engagement/).fill('disengage')
await page.locator('.rules-results a', { hasText: 'Engagement' }).first().waitFor()
await page.locator('.rules-results a', { hasText: 'Engagement' }).first().click()
assert.equal(await page.getByPlaceholder(/engagement/).inputValue(), '')

await page.goto(`${page.url().split('#')[0]}#/dungeon`)
await enterDungeon(page)
await page.getByRole('button', { name: 'Start sample battle' }).click()
await page.waitForSelector('.resolution')
await page.getByRole('button', { name: 'Skip to summary' }).click()
await page.getByRole('button', { name: 'Continue' }).click()
await page.getByRole('button', { name: 'Combat', exact: true }).first().click()
const dialog = page.getByRole('dialog', { name: 'Rules' })
await dialog.waitFor()
assert.match(await dialog.innerText(), /Combat takes place in rounds/)
await shot('popup', true)
await page.keyboard.press('Escape')
await dialog.waitFor({ state: 'detached' })
assert.ok(await page.locator('.engagement-group').count() > 0, 'the battle is still there')

console.log('rules check passed')
await browser.close()
report(errors)
